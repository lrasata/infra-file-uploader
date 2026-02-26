variable "environment" {
  description = "The environment for the deployment (e.g., dev, staging, prod)"
  type        = string
}

variable "region" {
  description = "The AWS region to deploy resources"
  type        = string
  default     = "eu-central-1"
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

variable "app_id" {
  description = "Application identifier for tagging resources"
  type        = string
  default     = ""
}

variable "sns_topic_arn" {
  description = "SNS topic for alarms."
  type        = string
}