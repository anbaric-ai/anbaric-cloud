/* CloudFront fronts the platform for TLS and edge caching. Caching follows
   the origin's Cache-Control headers - today the platform marks nothing
   cacheable (every response sits behind the session or token wall), so
   requests pass through; the moment a response carries Cache-Control it is
   cached at the edge. All viewer headers and cookies are forwarded so the
   Auth0 session flow and signed CLI tokens work unchanged. */

data "aws_cloudfront_cache_policy" "use_origin_cache_control" {
  name = "UseOriginCacheControlHeaders-QueryStrings"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "platform" {
  enabled     = true
  comment     = "anbaric-${var.environment}"
  price_class = "PriceClass_100"

  origin {
    origin_id   = "platform-alb"
    domain_name = aws_lb.platform.dns_name

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "http-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60
      origin_keepalive_timeout = 30
    }
  }

  default_cache_behavior {
    target_origin_id         = "platform-alb"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.use_origin_cache_control.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

locals {
  platform_public_url = var.platform_public_url != "" ? var.platform_public_url : "https://${aws_cloudfront_distribution.platform.domain_name}"
}
