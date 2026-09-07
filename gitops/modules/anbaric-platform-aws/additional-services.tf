/* An optional shared additional-services instance running in the tenant's own
   cluster: one Fargate task registered in Cloud Map as
   additional-services.<namespace>, reachable by deployed apps on port 8790.
   The platform passes its URL and API key into every app it deploys. */

locals {
  additional_services_count = var.deploy_additional_services ? 1 : 0

  additional_services_browserless = var.additional_services_browserless_token_secret_arn != ""

  additional_services_secret_arns = concat(
    [var.additional_services_api_key_secret_arn, var.additional_services_ai_gateway_token_secret_arn],
    local.additional_services_browserless ? [var.additional_services_browserless_token_secret_arn] : [],
  )

  additional_services_secrets = concat(
    [
      { name = "ANBARIC_SERVICE_API_KEYS", valueFrom = var.additional_services_api_key_secret_arn },
      { name = "ANBARIC_AI_GATEWAY_TOKEN", valueFrom = var.additional_services_ai_gateway_token_secret_arn },
    ],
    local.additional_services_browserless ? [
      { name = "BROWSERLESS_API_TOKEN", valueFrom = var.additional_services_browserless_token_secret_arn },
    ] : [],
  )
}

/* Apps reach this on 8790 and it runs in the apps security group, so the rule
   that lets them is an apps-to-itself ingress. It lives inline on that group
   rather than as an aws_security_group_rule: a group with inline ingress blocks
   treats them as the whole truth and revokes anything else on every apply, so a
   standalone rule here was created and then silently removed again the next
   time the group was reconciled - taking every app's access to this service
   with it. See aws_security_group.apps in app-hosting.tf. */

resource "aws_service_discovery_service" "additional_services" {
  count = local.additional_services_count
  name  = "additional-services"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.anbaric.id
    routing_policy = "MULTIVALUE"

    dns_records {
      type = "A"
      ttl  = 10
    }
  }
}

resource "aws_iam_role_policy" "additional_services_secrets" {
  count = local.additional_services_count
  name  = "read-additional-services-secrets"
  role  = aws_iam_role.app_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = local.additional_services_secret_arns
    }]
  })
}

resource "aws_ecs_task_definition" "additional_services" {
  count                    = local.additional_services_count
  family                   = "anbaric-${var.environment}-additional-services"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.app_execution.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name         = "additional-services"
    image        = var.additional_services_image
    essential    = true
    portMappings = [{ containerPort = 8790, protocol = "tcp" }]

    environment = [
      { name = "ANBARIC_ADDITIONAL_SERVICES_PORT", value = "8790" },
      { name = "ANBARIC_AI_GATEWAY_URL", value = var.additional_services_ai_gateway_url },
      { name = "ANBARIC_AGENTIC_MODEL", value = var.additional_services_agentic_model },
    ]

    secrets = local.additional_services_secrets

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.apps.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "additional-services"
      }
    }
  }])
}

resource "aws_ecs_service" "additional_services" {
  count           = local.additional_services_count
  name            = "anbaric-${var.environment}-additional-services"
  cluster         = aws_ecs_cluster.anbaric.id
  task_definition = aws_ecs_task_definition.additional_services[0].arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.apps.id]
    assign_public_ip = true
  }

  service_registries {
    registry_arn = aws_service_discovery_service.additional_services[0].arn
  }
}
