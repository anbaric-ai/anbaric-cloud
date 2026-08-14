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
