
output "api_gateway_invoke_url" {
  description = "Public URL for invoking the API Gateway"
  value       = "https://${var.api_file_upload_domain_name}/upload"
}

output "api_gateway_rest_api_id" {
  description = "ID of the API Gateway REST API"
  value       = aws_api_gateway_rest_api.api.id
}

output "api_gateway_stage_arn" {
  description = "ARN of the API Gateway stage"
  value       = aws_api_gateway_stage.api_gateway_stage.arn
}

output "api_gateway_domain_name_regional_domain_name" {
  description = "Regional domain name of the API Gateway"
  value       = aws_api_gateway_domain_name.api.regional_domain_name
}

output "api_gateway_domain_name_regional_zone_id" {
  description = "Regional zone ID of the API Gateway"
  value       = aws_api_gateway_domain_name.api.regional_zone_id
}