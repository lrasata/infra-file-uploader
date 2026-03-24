output "api_gateway_invoke_url" {
  description = "Public URL for invoking the API Gateway"
  value       = "https://${var.api_file_upload_domain_name}/upload"
}

output "api_gateway_rest_api_id" {
  description = "ID of the API Gateway HTTP API"
  value       = aws_apigatewayv2_api.api.id
}

output "api_gateway_stage_arn" {
  description = "ARN of the API Gateway stage"
  value       = aws_apigatewayv2_stage.api.arn
}

output "api_gateway_target_domain_name" {
  description = "Regional domain name of the API Gateway"
  value       = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
}

output "api_gateway_hosted_zone_id" {
  description = "Regional zone ID of the API Gateway"
  value       = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
}
