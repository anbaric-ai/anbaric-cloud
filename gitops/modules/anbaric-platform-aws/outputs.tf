output "platform_url" {
  value = local.platform_public_url
}

output "load_balancer_dns" {
  value = aws_lb.platform.dns_name
}

output "database_endpoint" {
  value = aws_db_instance.anbaric.address
}

output "cluster_name" {
  value = aws_ecs_cluster.anbaric.name
}

output "service_name" {
  value = aws_ecs_service.platform.name
}

output "certificate_validation_records" {
  value = var.platform_domain == "" ? [] : [
    for option in aws_acm_certificate.platform[0].domain_validation_options : {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
    }
  ]
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.platform.domain_name
}
