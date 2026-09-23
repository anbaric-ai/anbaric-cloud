output "platform_url" {
  value = local.platform_public_url
}

output "load_balancer_dns" {
  description = "The cell's load balancer; every tenant in the cell reports the same hostname and is told apart by its listener rule"
  value       = var.load_balancer_dns_name
}

output "cluster_name" {
  value = aws_ecs_cluster.anbaric.name
}

output "service_name" {
  value = aws_ecs_service.platform.name
}

output "target_group_arn" {
  value = aws_lb_target_group.platform.arn
}

# Guarded on `edge` as well as the domain: with a shared edge the certificate is
# never created, and indexing it would fail the plan rather than return nothing.
output "certificate_validation_records" {
  value = var.edge != "own" || var.platform_domain == "" ? [] : [
    for option in aws_acm_certificate.platform[0].domain_validation_options : {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
    }
  ]
}

output "cloudfront_domain" {
  value = var.edge == "own" ? aws_cloudfront_distribution.platform[0].domain_name : ""
}
