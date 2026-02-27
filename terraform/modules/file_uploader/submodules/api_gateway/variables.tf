variable "environment" {
  description = "The environment for the deployment (e.g., dev, staging, prod)"
  type        = string
}

variable "region" {
  description = "The AWS region to deploy resources"
  type        = string
  default     = "eu-central-1"
}

variable "app_id" {
  description = "Application identifier for tagging resources"
  type        = string
}

variable "api_file_upload_domain_name" {
  description = "The domain name for the API Gateway"
  type        = string
}

variable "backend_certificate_arn" {
  description = "The ARN of the ACM certificate for the domain"
  type        = string
}

variable "upload_file_lambda_function_name" {
  description = "Name of the upload file Lambda function"
  type        = string
}

variable "upload_file_lambda_arn" {
  description = "ARN of the upload file Lambda function"
  type        = string
}

variable "get_files_lambda_function_name" {
  description = "Name of the get files Lambda function"
  type        = string
}

variable "get_files_lambda_arn" {
  description = "ARN of the get files Lambda function"
  type        = string
}

variable "token_authorizer_arn" {
  description = "ARN of the api token authorizer Lambda function"
  type        = string
}

variable "sns_topic_arn" {
  description = "SNS topic for alarms."
  type        = string
}

variable "logs_retention_in_days" {
  description = "Number of days of retention of logs"
  type        = number
  default     = 30
}