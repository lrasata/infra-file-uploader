data "aws_caller_identity" "current" {}

resource "aws_kms_key" "s3_cmk" {
  description         = "CMK for S3 uploads and access logs"
  enable_key_rotation = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Allow root account full access
      {
        Sid    = "AllowRootAccount"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },

      # Allow S3 logging to use the key
      {
        Sid    = "AllowS3Logging"
        Effect = "Allow"
        Principal = {
          Service = "logging.s3.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
      ,
      # Allow Lambda functions (execution roles) from the same account to use the key for encrypt/decrypt and generate data key
      {
        Sid    = "AllowLambdasUseOfKey"
        Effect = "Allow"
        Principal = {
          AWS = "*" # enforced via condition on principal ARN
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:ReEncrypt*",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "aws:PrincipalArn" = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/*-lambda-*"
          }
        }
      }
    ]
  })
}

resource "aws_kms_alias" "s3_cmk_alias" {
  name          = "alias/${var.environment}-${var.app_id}-s3-cmk"
  target_key_id = aws_kms_key.s3_cmk.id
}

resource "aws_s3_bucket_server_side_encryption_configuration" "log_target_sse" {
  bucket = aws_s3_bucket.log_target.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3_cmk.arn
    }
  }
}