locals {
  partition_key = "id"
  sort_key      = "file_key"
}

resource "aws_dynamodb_table" "files_metadata_table" {
  name         = "${var.environment}-${var.app_id}-files-metadata"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = local.partition_key
  range_key    = local.sort_key

  attribute {
    name = local.partition_key
    type = "S"
  }

  attribute {
    name = local.sort_key
    type = "S"
  }

  tags = {
    Environment = var.environment
    App         = var.app_id
  }

  server_side_encryption {
    enabled = true
  }

  deletion_protection_enabled = var.environment == "prod" ? true : false

  point_in_time_recovery {
    enabled = true
  }

}

# MONITORING
module "monitor_dynamodb" {
  source        = "../monitoring/dynamodb"
  sns_topic_arn = var.sns_topic_alert_arn
  region        = var.region
  table_name    = aws_dynamodb_table.files_metadata_table.name
}