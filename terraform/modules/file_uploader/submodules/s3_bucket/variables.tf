variable "region" {
  description = "The AWS region to deploy resources"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "uploads_bucket_name" {
  description = "Base name for the uploads S3 bucket"
  type        = string
}

variable "enable_transfer_acceleration" {
  description = "Enable S3 Transfer Acceleration for faster uploads"
  type        = bool
  default     = false
}

variable "app_id" {
  description = "Application identifier for tagging resources"
  type        = string
  default     = ""
}

variable "sns_topic_alert_arn" {
  description = "SNS topic alert arn is used monitoring S3"
  type        = string
}