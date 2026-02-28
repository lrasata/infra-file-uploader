output "api_gateway_invoke_url" {
  description = "Public URL for invoking the API Gateway"
  value       = "https://${var.api_file_upload_domain_name}/upload"
}

output "uploads_bucket_id" {
  description = "The S3 uploads bucket ID (name)"
  value       = module.file_uploader.uploads_bucket_id
}

output "uploads_bucket_arn" {
  description = "The ARN of the S3 uploads bucket"
  value       = module.file_uploader.uploads_bucket_arn
}