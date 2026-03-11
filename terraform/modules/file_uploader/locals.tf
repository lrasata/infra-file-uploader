locals {
  upload_folder    = "uploads/"
  thumbnail_folder = "thumbnails/"

  # Central configuration map for all Lambdas
  lambda_configs = {
    # Configuration for GET_PRESIGNED_URL
    get_presigned_url = {
      base_name    = "get-presigned-url"
      source_dir   = "${path.module}/src/lambdas/get_presigned_url"
      handler_file = "getPresignedUrl.handler"
      excludes     = []
      timeout      = 5
      memory_size  = 128
      # Variables unique to this Lambda
      environment_vars = {
        REGION             = var.region
        EXPIRATION_TIME_S  = var.lambda_upload_presigned_url_expiration_time_s
        UPLOAD_BUCKET      = module.s3_bucket.uploads_bucket_id
        API_NAME           = "get-presigned-url-api"
        API_GW_AUTH_SECRET = module.secrets.auth_secret
        UPLOAD_FOLDER      = local.upload_folder
        USE_S3_ACCEL       = var.enable_transfer_acceleration
        PARTITION_KEY      = module.dynamodb.partition_key
        SORT_KEY           = module.dynamodb.sort_key
      }
      # Policy unique to this Lambda
      iam_policy_statements = [
        {
          Action   = ["s3:GetObject", "s3:PutObject"]
          Effect   = "Allow"
          Resource = ["${module.s3_bucket.uploads_bucket_arn}/*"]
        },
        {
          Action   = ["secretsmanager:GetSecretValue"]
          Effect   = "Allow"
          Resource = [module.secrets.secret_arn]
        }
        ,
        {
          Action   = ["kms:GenerateDataKey", "kms:Decrypt"]
          Effect   = "Allow"
          Resource = [module.s3_bucket.uploads_bucket_kms_key_arn]
        },
        {
          Effect   = "Allow",
          Action   = ["cloudwatch:PutMetricData"],
          Resource = ["*"],
          Condition = {
            StringEquals = {
              "cloudwatch:Namespace" = "Custom/API"
            }
          }
        }
      ]
    }
    # Configuration for PROCESS_UPLOADED_FILE
    process_uploaded_file = {
      base_name    = "process-uploaded-file"
      source_dir   = "${path.module}/src/lambdas/process_uploaded_file"
      handler_file = "processUploadedFile.handler"
      excludes     = ["node_modules/.bin/*"]
      timeout      = 30
      memory_size  = var.lambda_memory_size_mb
      # Variables unique to this Lambda
      environment_vars = {
        BUCKET_AV_ENABLED        = var.use_bucket_av
        UPLOAD_FOLDER            = local.upload_folder
        THUMBNAIL_FOLDER         = local.thumbnail_folder
        DYNAMO_TABLE             = module.dynamodb.files_metadata_table_name
        PARTITION_KEY            = module.dynamodb.partition_key
        SORT_KEY                 = module.dynamodb.sort_key
        FILE_PROCESSED_TOPIC_ARN = module.sns_processed_file_event.sns_topic_arn
      }
      # Policy unique to this Lambda
      iam_policy_statements = [
        {
          Effect   = "Allow",
          Action   = ["dynamodb:Query", "dynamodb:Scan", "dynamodb:PutItem", "dynamodb:UpdateItem"],
          Resource = [module.dynamodb.files_metadata_table_arn]
        },
        {
          Action = ["s3:GetObject", "s3:GetObjectVersion", "s3:ListBucket", "s3:PutObject"]
          Effect = "Allow"
          Resource = [
            "${module.s3_bucket.uploads_bucket_arn}/*",
            module.s3_bucket.uploads_bucket_arn
          ]
        }
        ,
        {
          Action   = ["kms:GenerateDataKey", "kms:Decrypt"]
          Effect   = "Allow"
          Resource = [module.s3_bucket.uploads_bucket_kms_key_arn]
        },
        {
          Effect   = "Allow",
          Action   = ["cloudwatch:PutMetricData"],
          Resource = ["*"],
          Condition = {
            StringEquals = {
              "cloudwatch:Namespace" = [
                "Custom/MetadataWriter",
                "Custom/ThumbnailGenerator"
              ]
            }
          }
        },
        {
          Effect = "Allow"
          Action = [
            "sns:Publish"
          ]
          Resource = [
            module.sns_processed_file_event.sns_topic_arn
          ]
        }
      ]
    }
  }

  depends_on = [module.s3_bucket, module.dynamodb, module.sns_processed_file_event]
}