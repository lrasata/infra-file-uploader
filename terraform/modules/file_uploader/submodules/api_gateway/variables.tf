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

variable "lambdas" {
  description = "All lambdas data in format : [key]: { lambda_arn: ..., lambda_function_name: ...} to be configured in API GW"
  type = map(object({
    lambda_arn           = string
    lambda_function_name = string
  }))
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