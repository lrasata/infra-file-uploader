output "sns_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

output "sns_kms_cmk_arn" {
  value = aws_kms_key.sns_cmk.arn
}