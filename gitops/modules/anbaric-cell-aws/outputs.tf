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

output "peering_connection_id" {
  description = "The peer's own route table must carry the route back, inline, for the same reason this one does"
  value       = var.peer_vpc_id == "" ? "" : aws_vpc_peering_connection.databases[0].id
}
