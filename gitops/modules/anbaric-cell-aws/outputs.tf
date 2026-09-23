output "vpc_id" {
  value = aws_vpc.anbaric.id
}

output "vpc_cidr_block" {
  value = aws_vpc.anbaric.cidr_block
}

output "subnet_ids" {
  value = aws_subnet.public[*].id
}

output "route_table_id" {
  value = aws_route_table.public.id
}

output "load_balancer_dns" {
  description = "Every tenant in this cell routes to this one hostname; the listener rules tell them apart"
  value       = aws_lb.platform.dns_name
}

output "load_balancer_listener_arn" {
  value = aws_lb_listener.http.arn
}

output "load_balancer_security_group_id" {
  value = aws_security_group.load_balancer.id
}
