output "files_metadata_table_name" {
  description = "The name of the DynamoDB table"
  value       = aws_dynamodb_table.files_metadata_table.name
}

output "files_metadata_table_arn" {
  description = "The ARN of the DynamoDB table"
  value       = aws_dynamodb_table.files_metadata_table.arn
}

output "files_metadata_table_gsi_arn" {
  description = "The ARN GSI of the DynamoDB table "
  value       = "${aws_dynamodb_table.files_metadata_table.arn}/index/${local.gsi_name}"
}

output "partition_key" {
  description = "The partition key name for the DynamoDB table"
  value       = local.partition_key
}

output "sort_key" {
  description = "The sort key name for the DynamoDB table"
  value       = local.sort_key
}
