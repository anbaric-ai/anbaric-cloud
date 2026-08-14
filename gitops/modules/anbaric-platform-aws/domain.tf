/* Custom domain for the platform: an ACM certificate in us-east-1 (a
   CloudFront requirement - certificate only, no compute), DNS-validated
   through the delegated Route53 zone, and alias records pointing the domain
   at the distribution. Skipped entirely when platform_domain is unset. */

data "aws_route53_zone" "platform" {
  count = var.platform_domain == "" ? 0 : 1
  name  = var.dns_zone_name
}

resource "aws_acm_certificate" "platform" {
  count             = var.platform_domain == "" ? 0 : 1
  provider          = aws.us_east_1
  domain_name       = var.platform_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "certificate_validation" {
  for_each = var.platform_domain == "" ? {} : {
    for option in aws_acm_certificate.platform[0].domain_validation_options :
    option.domain_name => option
  }

  zone_id = data.aws_route53_zone.platform[0].zone_id
  name    = each.value.resource_record_name
  type    = each.value.resource_record_type
  ttl     = 300
  records = [each.value.resource_record_value]
}

resource "aws_acm_certificate_validation" "platform" {
  count                   = var.platform_domain == "" ? 0 : 1
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.platform[0].arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}

resource "aws_route53_record" "platform" {
  for_each = var.platform_domain == "" ? toset([]) : toset(["A", "AAAA"])

  zone_id = data.aws_route53_zone.platform[0].zone_id
  name    = var.platform_domain
  type    = each.value

  alias {
    name                   = aws_cloudfront_distribution.platform.domain_name
    zone_id                = aws_cloudfront_distribution.platform.hosted_zone_id
    evaluate_target_health = false
  }
}
