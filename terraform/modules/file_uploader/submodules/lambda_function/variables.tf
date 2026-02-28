# ==============================================================================
# 1. CORE NAMING & ENVIRONMENT VARIABLES
# ==============================================================================

variable "environment" {
  description = "The deployment environment (e.g., 'dev', 'prod'). Used for resource naming prefixes."
  type        = string
}

variable "lambda_name" {
  description = "The unique base name for this specific Lambda function (e.g., 'upload-file'). Used in resource names, tags, and the ZIP filename."
  type        = string
}

variable "app_id" {
  description = "A unique identifier or name for the application. Used in resource tags."
  type        = string
}

# ==============================================================================
# 2. PACKAGING VARIABLES
# ==============================================================================

variable "source_dir" {
  description = "The path to the Lambda function's source code directory (where package.json is located)."
  type        = string
}

variable "excludes" {
  description = "A list of patterns to exclude from the Lambda deployment ZIP file."
  type        = list(string)
  default     = []
}

# ==============================================================================
# 3. LAMBDA CONFIGURATION VARIABLES
# ==============================================================================

variable "handler_file" {
  description = "The function entry point in the format 'filename.handlerName' (e.g., 'index.handler')."
  type        = string
}

variable "timeout" {
  description = "The amount of time (in seconds) that the Lambda function has to run before stopping."
  type        = number
  default     = 5
}

variable "memory_size" {
  description = "The amount of memory (in MB) allocated to the Lambda function."
  type        = number
  default     = 128
}

variable "environment_vars" {
  description = "A map of key/value pairs to set as environment variables for the Lambda function."
  type        = map(string)
  default     = {}
}

# ==============================================================================
# 4. IAM POLICY VARIABLES
# ==============================================================================

variable "iam_policy_statements" {
  description = "A list of IAM statement maps defining the custom permissions required by the Lambda function (e.g., S3 or DynamoDB access)."
  type = list(object({
    Action   = list(string)
    Effect   = string
    Resource = any # <--- Use 'any' to accept either a single string or a list(string)
  }))
}