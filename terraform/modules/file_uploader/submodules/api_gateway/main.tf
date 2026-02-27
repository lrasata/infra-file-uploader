locals {
  routes = {
    "upload-url" = {
      lambda_arn           = var.upload_file_lambda_arn
      lambda_function_name = var.upload_file_lambda_function_name
    }
    "files" = {
      lambda_arn           = var.get_files_lambda_arn
      lambda_function_name = var.get_files_lambda_function_name
    }
  }
}

resource "aws_api_gateway_rest_api" "api" {
  name        = "${var.environment}-${var.app_id}-api"
  description = "API Gateway for ${var.app_id} backend endpoints"

  tags = {
    Name        = "${var.environment}-${var.app_id}-api"
    Environment = var.environment
    App         = var.app_id
  }
}

resource "aws_api_gateway_resource" "routes" {
  for_each    = local.routes
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = each.key
}

# GET Method
resource "aws_api_gateway_method" "get_methods" {
  for_each      = local.routes
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.routes[each.key].id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    "method.request.header.x-api-gateway-file-upload-auth" = true
  }
}

# Lambda integration
resource "aws_api_gateway_integration" "lambda_integrations" {
  for_each    = local.routes
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.routes[each.key].id
  http_method = aws_api_gateway_method.get_methods[each.key].http_method
  # Proxy integration : API Gateway forwards the entire HTTP request (headers, path, query string, body, etc.) directly to your backend Lambda function as-is
  type = "AWS_PROXY"
  # even though API method is GET, when using AWS_PROXY the integration must always be "POST"
  integration_http_method = "POST"
  uri                     = "arn:aws:apigateway:${var.region}:lambda:path/2015-03-31/functions/${each.value.lambda_arn}/invocations"
}

# Lambda permission
resource "aws_lambda_permission" "apigw_permissions" {
  for_each = local.routes

  statement_id  = "AllowAPIGatewayInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# OPTIONS method with CORS headers
resource "aws_api_gateway_method" "options_methods" {
  for_each      = local.routes
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.routes[each.key].id
  http_method   = "OPTIONS"
  authorization = "NONE" # NB: this allows public access
}

resource "aws_api_gateway_integration" "options_integrations" {
  for_each    = local.routes
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.routes[each.key].id
  http_method = aws_api_gateway_method.options_methods[each.key].http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options_responses" {
  for_each    = local.routes
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.routes[each.key].id
  http_method = aws_api_gateway_method.options_methods[each.key].http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "options_integration_responses" {
  for_each    = local.routes
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.routes[each.key].id
  http_method = aws_api_gateway_method.options_methods[each.key].http_method
  status_code = aws_api_gateway_method_response.options_responses[each.key].status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,x-api-gateway-file-upload-auth,X-Requested-With,Accept,Origin'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,PUT'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_api_gateway_deployment" "deployment" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  triggers = {
    redeployment = sha1(jsonencode([
      for k in keys(local.routes) : [
        aws_api_gateway_method.get_methods[k].id,
        aws_api_gateway_integration.lambda_integrations[k].id,
        aws_api_gateway_method.options_methods[k].id,
        aws_api_gateway_integration.options_integrations[k].id
      ]
    ]))
  }

  depends_on = [
    aws_api_gateway_integration.lambda_integrations,
    aws_api_gateway_integration.options_integrations
  ]
}

# Sets CloudWatch Logs role for the entire AWS account
# API stage cannot apply logging until this account-level setting exists.
resource "aws_api_gateway_account" "account" {
  cloudwatch_role_arn = aws_iam_role.cloudwatch_role.arn
}

# Define a CloudWatch Log Group
resource "aws_cloudwatch_log_group" "api_gateway_access_logs" {
  name              = "/aws/apigw/${var.environment}-${var.app_id}-access-logs"
  retention_in_days = var.logs_retention_in_days
}

# Define the IAM Role that API Gateway uses to write logs
resource "aws_iam_role" "cloudwatch_role" {
  name = "${var.environment}-apigw-cloudwatch-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "apigateway.amazonaws.com"
      }
    }]
  })
}

# Attach the policy allowing logging
resource "aws_iam_role_policy_attachment" "cloudwatch_attachment" {
  role       = aws_iam_role.cloudwatch_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_api_gateway_stage" "api_gateway_stage" {
  deployment_id        = aws_api_gateway_deployment.deployment.id
  rest_api_id          = aws_api_gateway_rest_api.api.id
  stage_name           = var.environment
  xray_tracing_enabled = true

  depends_on = [aws_api_gateway_account.account]

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
}

resource "aws_api_gateway_domain_name" "api" {
  domain_name              = var.api_file_upload_domain_name
  regional_certificate_arn = var.backend_certificate_arn
  endpoint_configuration {
    types = ["REGIONAL"]
  }
  # 💡 MODERN POLICY ONLY - only supporting at least TLS 1.2 can connect to this API
  security_policy = "TLS_1_2"

  tags = {
    Name        = var.api_file_upload_domain_name
    Environment = var.environment
    App         = var.app_id
  }
}

resource "aws_api_gateway_base_path_mapping" "api_mapping" {
  domain_name = aws_api_gateway_domain_name.api.domain_name
  api_id      = aws_api_gateway_rest_api.api.id
  stage_name  = aws_api_gateway_stage.api_gateway_stage.stage_name
  base_path   = "" # empty string means root path
}

module "monitoring_api_gw" {
  source        = "../monitoring/api_gateway"
  api_name      = aws_api_gateway_rest_api.api.name
  region        = var.region
  sns_topic_arn = var.sns_topic_arn
}