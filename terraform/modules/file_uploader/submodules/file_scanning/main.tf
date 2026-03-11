
# If var.use_bucketav == true, BucketAV is enabled
# Lambda for processing uploaded file is triggered when SNS receives findings from BucketAV
# Lambda only processes files tagged "clean" by BucketAV

data "aws_sns_topic" "bucketav_results" {
  count = var.use_bucketav ? 1 : 0
  name  = var.bucketav_sns_findings_topic_name
}

resource "aws_sns_topic_subscription" "lambda" {
  count     = var.use_bucketav ? 1 : 0
  topic_arn = data.aws_sns_topic.bucketav_results[count.index].arn
  protocol  = "lambda"
  endpoint  = var.process_uploaded_file_lambda_arn

  depends_on = [aws_lambda_permission.allow_sns]
}

resource "aws_lambda_permission" "allow_sns" {
  count         = var.use_bucketav ? 1 : 0
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = var.process_uploaded_file_lambda_function_name
  principal     = "sns.amazonaws.com"
  source_arn    = data.aws_sns_topic.bucketav_results[count.index].arn
}

# If BucketAV is disabled
# Lambda for processing uploaded file is directly triggered by S3 bucket notification

resource "aws_lambda_permission" "allow_s3_to_invoke_process_uploaded_file" {
  count         = var.use_bucketav ? 0 : 1
  statement_id  = "AllowExecutionFromS3"
  action        = "lambda:InvokeFunction"
  function_name = var.process_uploaded_file_lambda_function_name
  principal     = "s3.amazonaws.com"
  source_arn    = var.uploads_bucket_arn
}

resource "aws_s3_bucket_notification" "source_notification" {
  count  = var.use_bucketav ? 0 : 1
  bucket = var.uploads_bucket_id

  lambda_function {
    lambda_function_arn = var.process_uploaded_file_lambda_arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = var.upload_folder
  }

  depends_on = [aws_lambda_permission.allow_s3_to_invoke_process_uploaded_file]
}
