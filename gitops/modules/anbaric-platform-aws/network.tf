data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "anbaric" {
  cidr_block           = "10.30.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "anbaric-${var.environment}" }
}

resource "aws_internet_gateway" "anbaric" {
  vpc_id = aws_vpc.anbaric.id

  tags = { Name = "anbaric-${var.environment}" }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.anbaric.id
  cidr_block              = cidrsubnet(aws_vpc.anbaric.cidr_block, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "anbaric-${var.environment}-public-${count.index}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.anbaric.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.anbaric.id
  }

  tags = { Name = "anbaric-${var.environment}-public" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "load_balancer" {
  name   = "anbaric-${var.environment}-alb"
  vpc_id = aws_vpc.anbaric.id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront_origin_facing.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "platform" {
  name   = "anbaric-${var.environment}-platform"
  vpc_id = aws_vpc.anbaric.id

  ingress {
    from_port       = var.hosting_port
    to_port         = var.hosting_port
    protocol        = "tcp"
    security_groups = [aws_security_group.load_balancer.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "database" {
  name   = "anbaric-${var.environment}-database"
  vpc_id = aws_vpc.anbaric.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.platform.id, aws_security_group.apps.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
