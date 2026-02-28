locals {
  partition_key = "id"
  sort_key      = "file_key"
  gsi_hash_key  = "resource"
  gsi_range_key = "uploaded_timestamp"
  gsi_name      = "ResourceIndex"
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

  attribute {
    name = local.gsi_hash_key
    type = "S"
  }

  attribute {
    name = local.gsi_range_key
    type = "S"
  }

  global_secondary_index {
    name            = local.gsi_name
    hash_key        = local.gsi_hash_key
    range_key       = local.gsi_range_key
    projection_type = "ALL"
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