resource "aws_wafv2_web_acl" "api_gw_waf" {
  name        = "${var.environment}-${var.app_id}-file-uploader-api-gw-waf"
  description = "WAF for API Gateway"
  scope       = "REGIONAL"

  tags = {
    Name        = "${var.environment}-${var.app_id}-file-uploader-api-gw-waf"
    Environment = var.environment
    App         = var.app_id
  }


  default_action {
    allow {}
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.environment}-${var.app_id}-fileUploaderApiGwWAF"
    sampled_requests_enabled   = true
  }

  # Managed rule group (common protections)
  rule {
    name     = "${var.environment}-${var.app_id}-AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.environment}-${var.app_id}-managedRules"
      sampled_requests_enabled   = true
    }
  }

  # Rate limiting per IP
  rule {
    name     = "${var.environment}-${var.app_id}-RateLimitPerIP"
    priority = 200

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 1000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.environment}-${var.app_id}-rateLimit"
      sampled_requests_enabled   = true
    }
  }
}

# Associate the WAF with API Gateway stage
resource "aws_wafv2_web_acl_association" "api_gw_assoc" {
  resource_arn = var.api_gateway_stage_arn
  web_acl_arn  = aws_wafv2_web_acl.api_gw_waf.arn
}