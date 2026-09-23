resource "aws_lb" "platform" {
  name               = "anbaric-${var.name}"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.load_balancer.id]
  subnets            = aws_subnet.public[*].id
  idle_timeout       = 120
}

/* Tenants attach themselves with a listener rule matching x-anbaric-tenant, so
   the default action is what happens when no tenant claims the request. A fixed
   404 rather than a forward: there is nothing safe to forward to, and a request
   that matches no rule must never land in somebody else's platform. It also
   makes a missing route show up as 4xx on this load balancer, which is a signal
   worth alarming on. */
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.platform.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "unknown tenant"
      status_code  = "404"
    }
  }
}
