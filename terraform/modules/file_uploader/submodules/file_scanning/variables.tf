variable "use_bucketav" {
  description = "Use BucketAV for malware scanning"
  type        = bool
}

variable "bucketav_sns_findings_topic_name" {
  description = "Name of SNS topic where BucketAV publishes findings"
  type        = string
  default     = ""
}

variable "process_uploaded_file_lambda_function_name" {
  description = "Name of the process uploaded file Lambda function"
  type        = string
}

variable "process_uploaded_file_lambda_arn" {
  description = "ARN of the process uploaded file Lambda function"
  type        = string
}

variable "uploads_bucket_id" {
  description = "ID of the uploads S3 bucket"
  type        = string
}

variable "uploads_bucket_arn" {
  description = "ARN of the uploads S3 bucket"
  type        = string
}

variable "upload_folder" {
  description = "S3 prefix for uploaded files"
  type        = string
}