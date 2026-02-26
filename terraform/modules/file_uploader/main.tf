# Call of the sns submodule
module "sns" {
  source = "./submodules/sns"

  environment        = var.environment
  app_id             = var.app_id
  notification_email = var.notification_email
}
# Call the S3 buckets submodule
module "s3_bucket" {
  source = "./submodules/s3_bucket"

  environment                  = var.environment
  app_id                       = var.app_id
  uploads_bucket_name          = var.uploads_bucket_name
  enable_transfer_acceleration = var.enable_transfer_acceleration
  sns_topic_alert_arn          = module.sns.sns_topic_alerts_arn
  region                       = var.region
}

# Call the DynamoDB submodule
module "dynamodb" {
  source = "./submodules/dynamodb"

  environment         = var.environment
  app_id              = var.app_id
  sns_topic_alert_arn = module.sns.sns_topic_alerts_arn
  region              = var.region
}

# Call the Secrets Manager submodule
module "secrets" {
  source = "./submodules/secrets"

  secret_store_name = var.secret_store_name
}

module "lambda_functions" {
  source = "./submodules/lambda_function"

  # for_each to loop over lambda_configs to set up upload_file and process_uploaded_file lambdas
  for_each = local.lambda_configs

  # Pass common variables
  environment = var.environment
  app_id      = var.app_id

  # Pass variables specific to the current iteration (key is the map key, value is the map content)
  lambda_name           = each.value.base_name
  source_dir            = each.value.source_dir
  handler_file          = each.value.handler_file
  excludes              = each.value.excludes
  timeout               = each.value.timeout
  memory_size           = each.value.memory_size
  environment_vars      = each.value.environment_vars
  iam_policy_statements = each.value.iam_policy_statements
}

# Call the API Gateway submodule
module "api_gateway" {
  source = "./submodules/api_gateway"

  environment                 = var.environment
  app_id                      = var.app_id
  region                      = var.region
  api_file_upload_domain_name = var.api_file_upload_domain_name
  backend_certificate_arn     = var.backend_certificate_arn

  # Lambda integration
  upload_file_lambda_arn           = module.lambda_functions["upload_file"].function_arn
  upload_file_lambda_function_name = module.lambda_functions["upload_file"].function_name

  sns_topic_arn = module.sns.sns_topic_alerts_arn

  depends_on = [module.lambda_functions]
}

# Call the WAF submodule
module "waf" {
  source = "./submodules/waf"

  environment           = var.environment
  api_gateway_stage_arn = module.api_gateway.api_gateway_stage_arn
  app_id                = var.app_id
}

# Call the Route53 submodule (if DNS is managed)
module "route53" {
  source = "./submodules/route53"

  api_file_upload_domain_name      = var.api_file_upload_domain_name
  api_gateway_regional_domain_name = module.api_gateway.api_gateway_domain_name_regional_domain_name
  api_gateway_regional_zone_id     = module.api_gateway.api_gateway_domain_name_regional_zone_id
  route53_zone_name                = var.route53_zone_name
}

# Optional: Antivirus submodule (conditional based on use_bucketav)
module "file_scanning" {
  source = "./submodules/file_scanning"

  bucketav_sns_findings_topic_name           = var.bucket_av_sns_findings_topic_name
  uploads_bucket_id                          = module.s3_bucket.uploads_bucket_id
  process_uploaded_file_lambda_arn           = module.lambda_functions["process_uploaded_file"].function_arn
  process_uploaded_file_lambda_function_name = module.lambda_functions["process_uploaded_file"].function_name
  upload_folder                              = local.upload_folder
  uploads_bucket_arn                         = module.s3_bucket.uploads_bucket_arn
  use_bucketav                               = var.use_bucket_av
}

# ============================================================================
# MONITORING Lambda functions
# ============================================================================
module "monitor_thumbnail_generation_lambda" {
  source      = "./submodules/monitoring/lambda_thumbnail_generator"
  environment = var.environment
  region      = var.region
}