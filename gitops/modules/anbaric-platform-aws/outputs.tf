output "platform_url" {
  value = local.platform_public_url
}

output "load_balancer_dns" {
  value = aws_lb.platform.dns_name
}

output "database_endpoint" {
  value = aws_db_instance.anbaric.address
}

output "bastion_instance_id" {
  description = "SSM target for database port forwarding; empty when the bastion is disabled"
  value       = var.enable_bastion ? aws_instance.bastion[0].id : ""
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
  value = var.edge == "own" ? aws_cloudfront_distribution.platform[0].domain_name : ""
}

