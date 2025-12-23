data "aws_secretsmanager_secret" "file_upload_secrets" {
  name = var.secret_store_name
}

data "aws_secretsmanager_secret_version" "file_upload_secrets_value" {
  secret_id = data.aws_secretsmanager_secret.file_upload_secrets.id
}

locals {
  auth_secret = jsondecode(data.aws_secretsmanager_secret_version.file_upload_secrets_value.secret_string)["API_GW_FILE_UPLOAD_AUTH_SECRET"]
}