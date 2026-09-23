/* A Postgres cluster shared by many tenants, each holding its own database and
   its own login role. Separation is REVOKE CONNECT plus a role per tenant, not
   the network: the cluster admits whole cells, and Postgres tells tenants apart
   inside it. Run one of these for platform data and another for app data so the
   two scale independently. */

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

resource "aws_db_subnet_group" "anbaric" {
  name       = "anbaric-${var.name}"
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "database" {
  name   = "anbaric-${var.name}-database"
  vpc_id = var.vpc_id

  /* Cells reach the cluster over a peering connection, where the source is an
     address rather than a security group, so this is the one place in the
     estate that admits a range. Keep the list to whole cells and nothing else. */
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    cidr_blocks     = var.allowed_cidr_blocks
    security_groups = var.allowed_security_group_ids
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "anbaric" {
  identifier              = "anbaric-${var.name}"
  engine                  = "postgres"
  instance_class          = var.instance_class
  allocated_storage       = var.allocated_storage
  max_allocated_storage   = var.max_allocated_storage
  db_name                 = var.database_name
  username                = "anbaric"
  password                = var.master_password
  db_subnet_group_name    = aws_db_subnet_group.anbaric.name
  vpc_security_group_ids  = [aws_security_group.database.id]
  publicly_accessible     = false
  backup_retention_period = var.backup_retention_days
  skip_final_snapshot     = var.skip_final_snapshot

  /* Every tenant platform holds its own pool against this one cluster, so the
     connection ceiling is tenants times pool size rather than the single-tenant
     default the instance class would pick. */
  parameter_group_name = aws_db_parameter_group.anbaric.name
}

resource "aws_db_parameter_group" "anbaric" {
  name   = "anbaric-${var.name}"
  family = var.parameter_group_family

  parameter {
    name         = "max_connections"
    value        = var.max_connections
    apply_method = "pending-reboot"
  }

  lifecycle {
    create_before_destroy = true
  }
}
