/* The network belongs to the cell this tenant sits in; all that is left here is
   the tenant's own boundary. Every rule names a source security group rather
   than an address, which is what lets tenants share a subnet safely: two
   tenants in one cell cannot reach each other because neither group admits the
   other, whatever addresses they happen to be given. */

resource "aws_security_group" "platform" {
  name   = "anbaric-${var.environment}-platform"
  vpc_id = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# The platform group's ingress is managed as standalone rules, not inline, so
# it does not conflict with the internal-port rule app-hosting.tf attaches to
# the same group. An inline ingress block is authoritative and would revoke any
# rule it doesn't list.
resource "aws_security_group_rule" "platform_from_load_balancer" {
  type                     = "ingress"
  from_port                = var.hosting_port
  to_port                  = var.hosting_port
  protocol                 = "tcp"
  security_group_id        = aws_security_group.platform.id
  source_security_group_id = var.load_balancer_security_group_id
}
