/* Custom domain for the platform. anbaric.ai's DNS is managed manually in
   Cloudflare, so tofu only creates the ACM certificate (us-east-1 - a
   CloudFront requirement; certificate only, no compute) and waits for it to
   validate. Two records are added by hand in Cloudflare (both DNS-only):
   the certificate validation CNAME from the certificate_validation_records
   output, and a CNAME from the platform domain to the CloudFront domain. */

resource "aws_acm_certificate" "platform" {
  count             = var.edge == "own" && var.platform_domain != "" ? 1 : 0
  provider          = aws.us_east_1
  domain_name       = var.platform_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "platform" {
  count           = var.edge == "own" && var.platform_domain != "" ? 1 : 0
  provider        = aws.us_east_1
  certificate_arn = aws_acm_certificate.platform[0].arn
}
