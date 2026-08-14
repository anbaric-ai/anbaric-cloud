resource "aws_ecr_repository" "platform" {
  name         = "anbaric-${var.environment}-platform"
  force_delete = true
}

resource "terraform_data" "platform_image" {
  triggers_replace = {
    sources = sha1(join("", [for file in fileset(var.source_root, "{*/src/**,anbaric-cloud-hosting/Dockerfile,package-lock.json}") : filesha1("${var.source_root}/${file}")]))
  }

  provisioner "local-exec" {
    command = <<-EOT
      aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.platform.repository_url}
      docker build --platform linux/amd64 -t ${aws_ecr_repository.platform.repository_url}:latest -f ${var.source_root}/anbaric-cloud-hosting/Dockerfile ${var.source_root}
      docker push ${aws_ecr_repository.platform.repository_url}:latest
    EOT
  }
}

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "anbaric-${var.environment}/database-url"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgres://anbaric:${var.db_password}@${aws_db_instance.anbaric.address}:5432/anbaric"
}

resource "aws_secretsmanager_secret" "auth0_client_secret" {
  name                    = "anbaric-${var.environment}/auth0-client-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "auth0_client_secret" {
  secret_id     = aws_secretsmanager_secret.auth0_client_secret.id
  secret_string = var.auth0_client_secret == "" ? "unused" : var.auth0_client_secret
}

resource "aws_cloudwatch_log_group" "platform" {
  name              = "/anbaric/${var.environment}/platform"
  retention_in_days = 30
}

resource "aws_iam_role" "execution" {
  name = "anbaric-${var.environment}-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "read_secrets" {
  name = "read-platform-secrets"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "secretsmanager:GetSecretValue"
      Resource = [
        aws_secretsmanager_secret.database_url.arn,
        aws_secretsmanager_secret.auth0_client_secret.arn,
      ]
    }]
  })
}

resource "aws_ecs_cluster" "anbaric" {
  name = "anbaric-${var.environment}"
}

/* Fargate offers no docker socket, so the platform runs with its default
   ProcessBuildLayer: deployed apps live as child processes inside this task
   and reach the internal entry point on localhost, which is never exposed. */
resource "aws_ecs_task_definition" "platform" {
  family                   = "anbaric-${var.environment}-platform"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "platform"
    image     = "${aws_ecr_repository.platform.repository_url}:latest"
    essential = true

    portMappings = [{ containerPort = var.hosting_port, protocol = "tcp" }]

    environment = concat([
      { name = "ANBARIC_HOSTING_PORT", value = tostring(var.hosting_port) },
      { name = "ANBARIC_INTERNAL_PORT", value = tostring(var.internal_port) },
      { name = "ANBARIC_PLATFORM_INTERNAL_URL", value = "http://localhost:${var.internal_port}" },
      { name = "ANBARIC_PLATFORM_PUBLIC_URL", value = local.platform_public_url },
    ], var.auth0_domain == "" ? [] : [
      { name = "ANBARIC_AUTHENTICATOR", value = "anbaric-cloud-hosting-auth-auth0" },
      { name = "ANBARIC_AUTH0_DOMAIN", value = var.auth0_domain },
      { name = "ANBARIC_AUTH0_CLIENT_ID", value = var.auth0_client_id },
    ])

    secrets = concat([
      { name = "ANBARIC_DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
    ], var.auth0_domain == "" ? [] : [
      { name = "ANBARIC_AUTH0_CLIENT_SECRET", valueFrom = aws_secretsmanager_secret.auth0_client_secret.arn },
    ])

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.platform.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "platform"
      }
    }
  }])
}

resource "aws_lb" "platform" {
  name               = "anbaric-${var.environment}"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.load_balancer.id]
  subnets            = aws_subnet.public[*].id
  idle_timeout       = 120
}

resource "aws_lb_target_group" "platform" {
  name        = "anbaric-${var.environment}"
  port        = var.hosting_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.anbaric.id
  target_type = "ip"

  health_check {
    path                = "/ping"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 15
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.platform.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.platform.arn
  }
}

/* Consumer registrations and running apps are in-memory and in-task, so the
   platform must stay a single task until they are persisted. */
resource "aws_ecs_service" "platform" {
  name                 = "anbaric-${var.environment}-platform"
  cluster              = aws_ecs_cluster.anbaric.id
  task_definition      = aws_ecs_task_definition.platform.arn
  desired_count        = 1
  launch_type          = "FARGATE"
  force_new_deployment = true

  triggers = {
    redeployment = terraform_data.platform_image.id
  }

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.platform.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.platform.arn
    container_name   = "platform"
    container_port   = var.hosting_port
  }

  depends_on = [aws_lb_listener.http, terraform_data.platform_image]
}
