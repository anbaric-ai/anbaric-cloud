/* A cell is the network many tenants share: one VPC, one pair of public subnets
   and one load balancer. Tenants are kept apart inside it by security groups,
   never by addresses, so nothing here is per tenant. A tenant that genuinely
   needs its own routing gets its own cell rather than its own subnet. */

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "anbaric" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "anbaric-${var.name}" }
}

resource "aws_internet_gateway" "anbaric" {
  vpc_id = aws_vpc.anbaric.id

  tags = { Name = "anbaric-${var.name}" }
}

/* Sized for the whole cell, not for one tenant: every Fargate task takes an
   address, so a cell's worth of platforms and their apps needs far more than
   the /24 a single-tenant stack used to get. */
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.anbaric.id
  cidr_block              = cidrsubnet(aws_vpc.anbaric.cidr_block, var.subnet_newbits, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "anbaric-${var.name}-public-${count.index}" }
}

/* Every route this table will ever have is declared here. An inline route block
   is authoritative: a route added separately as an aws_route is revoked the next
   time this resource is reconciled, silently, which is how the databases became
   unreachable twice. The same trap is documented for security group ingress
   elsewhere in this estate. */
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.anbaric.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.anbaric.id
  }

  dynamic "route" {
    for_each = var.peer_vpc_id == "" ? [] : [var.peer_cidr_block]

    content {
      cidr_block                = route.value
      vpc_peering_connection_id = aws_vpc_peering_connection.databases[0].id
    }
  }

  tags = { Name = "anbaric-${var.name}-public" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

/* Admits CloudFront only. Note this is not a trust boundary on its own: the
   managed list covers every CloudFront distribution, not just ours. What keeps
   tenants apart is the per-tenant session secret and the membership check. */
resource "aws_security_group" "load_balancer" {
  name   = "anbaric-${var.name}-alb"
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
