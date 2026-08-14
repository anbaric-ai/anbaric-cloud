resource "aws_db_subnet_group" "anbaric" {
  name       = "anbaric-${var.environment}"
  subnet_ids = aws_subnet.public[*].id
}

resource "aws_db_instance" "anbaric" {
  identifier             = "anbaric-${var.environment}"
  engine                 = "postgres"
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  db_name                = "anbaric"
  username               = "anbaric"
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.anbaric.name
  vpc_security_group_ids = [aws_security_group.database.id]
  publicly_accessible    = false
  skip_final_snapshot    = true
}
