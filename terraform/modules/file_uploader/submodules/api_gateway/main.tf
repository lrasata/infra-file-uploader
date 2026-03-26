resource "aws_apigatewayv2_api" "api" {
  name          = "${var.environment}-${var.app_id}-api"
  protocol_type = "HTTP"
  description   = "API Gateway for ${var.app_id} backend endpoints"

  cors_configuration {
    allow_origins  = ["https://${var.cloudfront_domain_name}"]
    allow_methods  = ["GET", "PUT", "OPTIONS"]
    allow_headers  = ["*"]
    expose_headers = ["*"]
  }

  tags = {
    Name        = "${var.environment}-${var.app_id}-api"
    Environment = var.environment
    App         = var.app_id
  }
}

# Cognito JWT authorizer
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.environment}-${var.app_id}-cognito-authorizer"

  jwt_configuration {
    audience = [var.cognito_user_pool_client_id]
    issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${var.cognito_user_pool_id}"
  }
}

# Stage
resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = var.environment
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_access_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      caller         = "$context.identity.caller"
      user           = "$context.identity.user"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }

  default_route_settings {
    throttling_burst_limit   = 500
    throttling_rate_limit    = 1000
    detailed_metrics_enabled = true
  }
}

# Custom domain name
resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = var.api_file_upload_domain_name

  domain_name_configuration {
    certificate_arn = var.backend_certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = {
    Name        = var.api_file_upload_domain_name
    Environment = var.environment
    App         = var.app_id
  }
}

resource "aws_apigatewayv2_api_mapping" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.api.id
}

# Lambda integrations — one per entry in var.lambdas
resource "aws_apigatewayv2_integration" "lambda_integrations" {
  for_each           = var.lambdas
  api_id             = aws_apigatewayv2_api.api.id
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = "arn:aws:apigateway:${var.region}:lambda:path/2015-03-31/functions/${each.value.lambda_arn}/invocations"
}

# GET routes — protected by Cognito
resource "aws_apigatewayv2_route" "get_routes" {
  for_each           = var.lambdas
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "GET /${each.key}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_integrations[each.key].id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

# Lambda invoke permissions
resource "aws_lambda_permission" "apigw_routes_permissions" {
  for_each      = var.lambdas
  statement_id  = "AllowAPIGatewayInvoke-${replace(each.key, "/", "_")}"
  action        = "lambda:InvokeFunction"
  function_name = each.value.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# CloudWatch log group
resource "aws_cloudwatch_log_group" "api_gateway_access_logs" {
  name              = "/aws/apigw/${var.environment}-${var.app_id}-access-logs"
  retention_in_days = var.logs_retention_in_days
}

# Monitoring
module "monitoring_api_gw" {
  source        = "../monitoring/api_gateway"
  api_name      = aws_apigatewayv2_api.api.name
  region        = var.region
  sns_topic_arn = var.sns_topic_arn
}
