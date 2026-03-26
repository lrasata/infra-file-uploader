module "file_uploader" {
  source = "../../modules/file_uploader"

  region                                        = var.region
  environment                                   = var.environment
  app_id                                        = var.app_id
  api_file_upload_domain_name                   = var.api_file_upload_domain_name
  backend_certificate_arn                       = var.backend_certificate_arn
  uploads_bucket_name                           = var.uploads_bucket_name
  enable_transfer_acceleration                  = var.enable_transfer_acceleration
  lambda_upload_presigned_url_expiration_time_s = var.lambda_upload_presigned_url_expiration_time_s
  use_bucket_av                                 = var.use_bucketav
  bucket_av_sns_findings_topic_name             = var.bucketav_sns_findings_topic_name
  lambda_memory_size_mb                         = var.lambda_memory_size_mb
  route53_zone_name                             = var.route53_zone_name
  notification_email                            = var.notification_email
}