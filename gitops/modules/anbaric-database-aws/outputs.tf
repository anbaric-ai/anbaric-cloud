output "address" {
  value = aws_db_instance.anbaric.address
}

output "port" {
  value = aws_db_instance.anbaric.port
}

output "endpoint" {
  value = aws_db_instance.anbaric.endpoint
}

output "master_username" {
  value = aws_db_instance.anbaric.username
}

output "security_group_id" {
  value = aws_security_group.database.id
}

output "admin_url" {
  description = "Connection URL for the control plane, which creates each tenant's database and role"
  value       = "postgres://${aws_db_instance.anbaric.username}:${urlencode(var.master_password)}@${aws_db_instance.anbaric.endpoint}/postgres"
  sensitive   = true
}
