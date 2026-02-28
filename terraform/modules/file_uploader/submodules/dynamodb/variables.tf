variable "environment" {
  description = "Environment name (dev, staging, prod, ...)"
  type        = string
}

variable "app_id" {
  description = "Application identifier for tagging resources"
  type        = string
  default     = ""
}

variable "sns_topic_alert_arn" {
  description = "SNS topic alert arn is used monitoring the db table"
  type        = string
}

variable "region" {
  description = "The AWS region to deploy resources"
  type        = string
  default     = "eu-central-1"
}