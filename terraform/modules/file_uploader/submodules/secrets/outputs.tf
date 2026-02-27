
output "api_token" {
  description = "The API Gateway authentication secret from Secrets Manager"
  value       = local.api_token
  sensitive   = true
}

output "secret_arn" {
  description = "The ARN of the secret"
  value       = data.aws_secretsmanager_secret.file_upload_secrets.arn
}