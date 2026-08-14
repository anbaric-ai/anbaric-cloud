data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "platform" {
  name   = "anbaric-${var.environment}-platform"
  vpc_id = data.aws_vpc.default.id

  ingress {
    from_port   = var.hosting_port
    to_port     = var.hosting_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
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
  vpc_id = data.aws_vpc.default.id

  ingress {
    from_port       = 5432
    to_port         = 5432
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

resource "aws_db_instance" "anbaric" {
  identifier             = "anbaric-${var.environment}"
  engine                 = "postgres"
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  db_name                = "anbaric"
  username               = "anbaric"
  password               = var.db_password
  vpc_security_group_ids = [aws_security_group.database.id]
  skip_final_snapshot    = true
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

resource "aws_ecs_cluster" "anbaric" {
  name = "anbaric-${var.environment}"
}

resource "aws_ecs_task_definition" "platform" {
  family                   = "anbaric-${var.environment}-platform"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn

  container_definitions = jsonencode([{
    name      = "platform"
    image     = var.image
    essential = true

    portMappings = [{ containerPort = var.hosting_port }]

    environment = concat([
      { name = "ANBARIC_DATABASE_URL", value = "postgres://anbaric:${var.db_password}@${aws_db_instance.anbaric.address}:5432/anbaric" },
      { name = "ANBARIC_HOSTING_PORT", value = tostring(var.hosting_port) },
    ], var.auth0_domain == "" ? [] : [
      { name = "ANBARIC_AUTHENTICATOR", value = "anbaric-cloud-hosting-auth-auth0" },
      { name = "ANBARIC_AUTH0_DOMAIN", value = var.auth0_domain },
      { name = "ANBARIC_AUTH0_AUDIENCE", value = var.auth0_audience },
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

resource "aws_ecs_service" "platform" {
  name            = "anbaric-${var.environment}-platform"
  cluster         = aws_ecs_cluster.anbaric.id
  task_definition = aws_ecs_task_definition.platform.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.platform.id]
    assign_public_ip = true
  }
}
