/* Everything anbaric deploy needs on AWS: CodeBuild bakes each uploaded app
   into an image using the platform image as its base, and the platform runs
   one ECS service per app, discovered through Cloud Map DNS. */

data "aws_caller_identity" "current" {}

resource "aws_ecr_repository" "apps" {
  name         = "anbaric-${var.environment}-apps"
  force_delete = true
}

resource "aws_s3_bucket" "app_builds" {
  bucket        = "anbaric-${var.environment}-app-builds-${data.aws_caller_identity.current.account_id}"
  force_destroy = true
}

resource "aws_s3_bucket_lifecycle_configuration" "app_builds" {
  bucket = aws_s3_bucket.app_builds.id

  rule {
    id     = "expire-build-contexts"
    status = "Enabled"

    filter {}

    expiration {
      days = 7
    }
  }
}

resource "aws_service_discovery_private_dns_namespace" "anbaric" {
  name = "anbaric-${var.environment}.local"
  vpc  = aws_vpc.anbaric.id
}

resource "aws_service_discovery_service" "platform" {
  name = "platform"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.anbaric.id
    routing_policy = "MULTIVALUE"

    dns_records {
      type = "A"
      ttl  = 10
    }
  }
}

resource "aws_security_group" "apps" {
  name   = "anbaric-${var.environment}-apps"
  vpc_id = aws_vpc.anbaric.id

  ingress {
    from_port       = 1024
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.platform.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group_rule" "platform_internal_from_apps" {
  type                     = "ingress"
  from_port                = var.internal_port
  to_port                  = var.internal_port
  protocol                 = "tcp"
  security_group_id        = aws_security_group.platform.id
  source_security_group_id = aws_security_group.apps.id
}

resource "aws_cloudwatch_log_group" "apps" {
  name              = "/anbaric/${var.environment}/apps"
  retention_in_days = 30
}

resource "aws_iam_role" "app_execution" {
  name = "anbaric-${var.environment}-app-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "app_execution" {
  role       = aws_iam_role.app_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "codebuild" {
  name = "anbaric-${var.environment}-app-build"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "codebuild.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "codebuild" {
  name = "bake-app-images"
  role = aws_iam_role.codebuild.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.app_builds.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage",
          "ecr:PutImage", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload",
        ]
        Resource = concat([aws_ecr_repository.apps.arn, aws_ecr_repository.platform.arn], var.extra_pull_repository_arns)
      },
    ]
  })
}

resource "aws_codebuild_project" "app_build" {
  name         = "anbaric-${var.environment}-app-build"
  service_role = aws_iam_role.codebuild.arn

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/standard:7.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = true
  }

  source {
    type      = "NO_SOURCE"
    buildspec = <<-EOT
      version: 0.2
      phases:
        build:
          commands:
            - aws s3 cp "$TARBALL_S3_URI" app.tar.gz
            - mkdir app && tar -xzf app.tar.gz -C app
            - aws ecr get-login-password --region "$AWS_DEFAULT_REGION" | docker login --username AWS --password-stdin "$REPOSITORY_HOST"
            - docker build -t "$IMAGE_URI" app
            - docker push "$IMAGE_URI"
    EOT
  }
}

resource "aws_iam_role" "platform_task" {
  name = "anbaric-${var.environment}-platform-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "platform_deploys_apps" {
  name = "deploy-apps"
  role = aws_iam_role.platform_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.app_builds.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["codebuild:StartBuild", "codebuild:BatchGetBuilds"]
        Resource = aws_codebuild_project.app_build.arn
      },
      {
        Effect   = "Allow"
        Action   = ["ecs:RegisterTaskDefinition", "ecs:DescribeServices", "ecs:DescribeTasks", "ecs:ListTasks"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["ecs:CreateService", "ecs:UpdateService", "ecs:DeleteService"]
        Resource = "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/${aws_ecs_cluster.anbaric.name}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["servicediscovery:ListServices", "servicediscovery:CreateService", "servicediscovery:GetService"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = aws_iam_role.app_execution.arn
      },
    ]
  })
}
