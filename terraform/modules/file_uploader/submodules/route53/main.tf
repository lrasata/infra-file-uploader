# Look up an *existing* public Route 53 Hosted Zone by its DNS name.
data "aws_route53_zone" "main" {
  name         = var.route53_zone_name
  private_zone = false
}

# Create (or update) a DNS A-record in the hosted zone returned above.
# The record name is your API's custom domain, e.g. "staging-api-file-upload.example.com".
resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.api_file_upload_domain_name
  type    = "A"

  # Route 53 Alias record:
  # Point the record at the API Gateway regional custom domain endpoint.
  alias {
    name                   = var.api_gateway_regional_domain_name
    zone_id                = var.api_gateway_regional_zone_id
    evaluate_target_health = false
  }
}
