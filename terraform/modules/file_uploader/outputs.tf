output "api_gateway_invoke_url" {
  description = "Public URL for invoking the API Gateway"
  value       = "https://${var.api_file_upload_domain_name}/upload"
}

output "uploads_bucket_id" {
  description = "The S3 uploads bucket ID (name)"
  value       = module.s3_bucket.uploads_bucket_id
}

output "uploads_bucket_arn" {
  description = "The ARN of the S3 uploads bucket"
  value       = module.s3_bucket.uploads_bucket_arn
}

output "uploads_bucket_regional_domain_name" {
  description = "The regional domain name of the S3 bucket (for CloudFront origin)"
  value       = module.s3_bucket.uploads_bucket_regional_domain_name
}

output "dynamo_db_table_name" {
  description = "The name of the DynamoDB table"
  value       = module.dynamodb.files_metadata_table_name
}

output "dynamo_db_table_arn" {
  description = "The ARN of the DynamoDB table"
  value       = module.dynamodb.files_metadata_table_arn
}

output "sns_topic_arn_processed_file_event" {
  value = module.sns_processed_file_event.sns_topic_arn
}