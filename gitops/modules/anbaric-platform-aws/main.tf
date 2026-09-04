resource "aws_ecr_repository" "platform" {
  name         = "anbaric-${var.environment}-platform"
  force_delete = true
}

locals {
  image_sources_hash = var.build_image ? sha1(join("", [for file in fileset(var.source_root, "{*/src/**,*/tsconfig.build.json,tsconfig.build.base.json,anbaric-cloud-hosting/Dockerfile,package-lock.json}") : filesha1("${var.source_root}/${file}")])) : sha1(var.platform_image)
  platform_image     = var.platform_image != "" ? var.platform_image : "${aws_ecr_repository.platform.repository_url}:latest"
}

resource "terraform_data" "platform_image" {
  count = var.build_image ? 1 : 0

  triggers_replace = {
    sources = local.image_sources_hash
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
  secret_string = "postgres://anbaric:${var.db_password}@${aws_db_instance.anbaric.address}:5432/anbaric?sslmode=no-verify"
}

resource "aws_secretsmanager_secret" "auth0_client_secret" {
  name                    = "anbaric-${var.environment}/auth0-client-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "auth0_client_secret" {
  secret_id     = aws_secretsmanager_secret.auth0_client_secret.id
  secret_string = var.auth0_client_secret == "" ? "unused" : var.auth0_client_secret
}

# Signs the platform's stateless session cookies. Generated here so no secret
# value is handled by hand; rotating it (tofu taint) just forces re-login.
resource "random_password" "session_signing" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "session_signing" {
  name                    = "anbaric-${var.environment}/session-signing-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "session_signing" {
  secret_id     = aws_secretsmanager_secret.session_signing.id
  secret_string = random_password.session_signing.result
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
      Resource = concat([
        aws_secretsmanager_secret.database_url.arn,
        aws_secretsmanager_secret.app_db_password.arn,
        aws_secretsmanager_secret.auth0_client_secret.arn,
        aws_secretsmanager_secret.session_signing.arn,
      ], var.deploy_additional_services ? [var.additional_services_api_key_secret_arn] : [])
    }]
  })
}

resource "aws_ecs_cluster" "anbaric" {
  name = "anbaric-${var.environment}"
}

/* The platform deploys apps through the Fargate build layer: CodeBuild bakes
   each app image and every app becomes its own ECS service in this cluster,
   reached through Cloud Map DNS. */
resource "aws_ecs_task_definition" "platform" {
  family                   = "anbaric-${var.environment}-platform"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.platform_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "platform"
    image     = local.platform_image
    essential = true

    portMappings = [
      { containerPort = var.hosting_port, protocol = "tcp" },
      { containerPort = var.internal_port, protocol = "tcp" },
    ]

    environment = concat([
      { name = "ANBARIC_HOSTING_PORT", value = tostring(var.hosting_port) },
      { name = "ANBARIC_INTERNAL_PORT", value = tostring(var.internal_port) },
      { name = "ANBARIC_PLATFORM_INTERNAL_URL", value = "http://platform.${aws_service_discovery_private_dns_namespace.anbaric.name}:${var.internal_port}" },
      { name = "ANBARIC_PLATFORM_PUBLIC_URL", value = local.platform_public_url },
      { name = "ANBARIC_BUILD_LAYER", value = "fargate" },
      { name = "ANBARIC_AWS_CLUSTER", value = aws_ecs_cluster.anbaric.name },
      { name = "ANBARIC_AWS_SUBNETS", value = join(",", aws_subnet.public[*].id) },
      { name = "ANBARIC_AWS_APP_SECURITY_GROUP", value = aws_security_group.apps.id },
      { name = "ANBARIC_AWS_NAMESPACE_ID", value = aws_service_discovery_private_dns_namespace.anbaric.id },
      { name = "ANBARIC_AWS_NAMESPACE_NAME", value = aws_service_discovery_private_dns_namespace.anbaric.name },
      { name = "ANBARIC_AWS_APPS_REPOSITORY", value = aws_ecr_repository.apps.repository_url },
      { name = "ANBARIC_AWS_BUILD_BUCKET", value = aws_s3_bucket.app_builds.bucket },
      { name = "ANBARIC_AWS_BUILD_PROJECT", value = aws_codebuild_project.app_build.name },
      { name = "ANBARIC_AWS_BASE_IMAGE", value = local.platform_image },
      { name = "ANBARIC_AWS_APP_EXECUTION_ROLE", value = aws_iam_role.app_execution.arn },
      { name = "ANBARIC_AWS_APPS_LOG_GROUP", value = aws_cloudwatch_log_group.apps.name },
      { name = "ANBARIC_AWS_APPS_LOG_GROUP_ARN", value = aws_cloudwatch_log_group.apps.arn },
      { name = "ANBARIC_SQL_SCHEMA", value = "anbaric_app_data" },
      { name = "ANBARIC_AWS_APP_SQL_URL_SECRET", value = aws_secretsmanager_secret.app_db_url.arn },
      ], [for name, value in var.extra_environment : { name = name, value = value }], var.tenant == "" ? [] : [
      { name = "ANBARIC_TENANT", value = var.tenant },
      ], var.auth0_domain == "" ? [] : [
      { name = "ANBARIC_AUTHENTICATOR", value = "anbaric-cloud-hosting-auth-auth0" },
      { name = "ANBARIC_AUTH0_DOMAIN", value = var.auth0_domain },
      { name = "ANBARIC_AUTH0_CLIENT_ID", value = var.auth0_client_id },
      ], var.auth0_organization == "" ? [] : [
      { name = "ANBARIC_AUTH0_ORGANIZATION", value = var.auth0_organization },
      ], var.deploy_additional_services ? [
      { name = "ANBARIC_SERVICES_URL", value = "http://additional-services.${aws_service_discovery_private_dns_namespace.anbaric.name}:8790" },
    ] : [])

    secrets = concat([
      { name = "ANBARIC_DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
      { name = "ANBARIC_APP_DB_PASSWORD", valueFrom = aws_secretsmanager_secret.app_db_password.arn },
      { name = "ANBARIC_SESSION_SIGNING_SECRET", valueFrom = aws_secretsmanager_secret.session_signing.arn },
      ], var.auth0_domain == "" ? [] : [
      { name = "ANBARIC_AUTH0_CLIENT_SECRET", valueFrom = aws_secretsmanager_secret.auth0_client_secret.arn },
      ], var.deploy_additional_services ? [
      { name = "ANBARIC_SERVICES_API_KEY", valueFrom = var.additional_services_api_key_secret_arn },
    ] : [])

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
    redeployment = var.redeployment_trigger != "" ? var.redeployment_trigger : local.image_sources_hash
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

  service_registries {
    registry_arn = aws_service_discovery_service.platform.arn
  }

  depends_on = [aws_lb_listener.http, terraform_data.platform_image]
}
