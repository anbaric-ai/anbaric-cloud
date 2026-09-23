terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # backend "s3" {
  #   bucket = "anbaric-tofu-state"
  #   key    = "prod/terraform.tfstate"
  #   region = "eu-west-3"
  # }
}

provider "aws" {
  region = var.aws_region
}

/* CloudFront certificates must live in us-east-1 - certificate only, no
   compute leaves eu-west-3. */
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

/* eu-west-3 (Paris) keeps UK latency low while staying outside the
   eu-west-1/eu-west-2 regions that host the existing Anbaric estate. */
variable "aws_region" {
  type    = string
  default = "eu-west-3"

  validation {
    condition     = !contains(["eu-west-1", "eu-west-2"], var.aws_region)
    error_message = "eu-west-1 and eu-west-2 host the existing Anbaric estate and must not be used."
  }
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "auth0_domain" {
  type    = string
  default = ""
}

variable "auth0_client_id" {
  type    = string
  default = ""
}

variable "auth0_client_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "platform_public_url" {
  type    = string
  default = ""
}

variable "platform_domain" {
  type    = string
  default = ""
}

variable "app_db_password" {
  description = "Master password for the app data cluster"
  type        = string
  sensitive   = true
}

variable "tenant" {
  description = "Tenant name this install serves; also the routing key the load balancer matches on"
  type        = string
  default     = "anbaric"
}

/* A self-hosted install is one tenant in a cell of its own. The shape is the
   same as the hosted one - a cell holds the network and the load balancer, the
   clusters hold the data - so there is one topology to reason about rather than
   two. */
module "cell" {
  source = "../modules/anbaric-cell-aws"

  name       = "prod"
  cidr_block = "10.30.0.0/16"
}

module "platform_database" {
  source = "../modules/anbaric-database-aws"

  name            = "prod-platform"
  vpc_id          = module.cell.vpc_id
  subnet_ids      = module.cell.subnet_ids
  database_name   = "anbaric"
  master_password = var.db_password

  allowed_cidr_blocks = [module.cell.vpc_cidr_block]
  instance_class      = "db.t4g.small"
}

/* Apps get their own cluster so their load never competes with the platform's,
   and so an app can be given a credential that cannot reach platform data at
   all - a different cluster, not merely a different schema. */
module "app_database" {
  source = "../modules/anbaric-database-aws"

  name            = "prod-apps"
  vpc_id          = module.cell.vpc_id
  subnet_ids      = module.cell.subnet_ids
  database_name   = "anbaric"
  master_password = var.app_db_password

  allowed_cidr_blocks = [module.cell.vpc_cidr_block]
  instance_class      = "db.t4g.small"
}

/* The platform reads both URLs from Secrets Manager by name. In the hosted
   estate the control plane writes them while creating the tenant's databases;
   here there is one tenant per cluster, so the master credential is its own. */
resource "aws_secretsmanager_secret" "database_url" {
  name                    = "anbaric-tenant/${var.tenant}/database-url"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgres://${module.platform_database.master_username}:${urlencode(var.db_password)}@${module.platform_database.endpoint}/anbaric?sslmode=no-verify"
}

resource "aws_secretsmanager_secret" "app_db_url" {
  name                    = "anbaric-tenant/${var.tenant}/app-db-url"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "app_db_url" {
  secret_id     = aws_secretsmanager_secret.app_db_url.id
  secret_string = "postgres://${module.app_database.master_username}:${urlencode(var.app_db_password)}@${module.app_database.endpoint}/anbaric?sslmode=no-verify"
}

module "platform" {
  source = "../modules/anbaric-platform-aws"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment = "prod"
  aws_region  = var.aws_region
  source_root = "${path.root}/../.."

  vpc_id                          = module.cell.vpc_id
  subnet_ids                      = module.cell.subnet_ids
  load_balancer_dns_name          = module.cell.load_balancer_dns
  load_balancer_security_group_id = module.cell.load_balancer_security_group_id
  load_balancer_listener_arn      = module.cell.load_balancer_listener_arn
  load_balancer_rule_priority     = 1000

  auth0_domain        = var.auth0_domain
  auth0_client_id     = var.auth0_client_id
  auth0_client_secret = var.auth0_client_secret
  platform_public_url = var.platform_public_url
  platform_domain     = var.platform_domain
  tenant              = var.tenant

  depends_on = [aws_secretsmanager_secret_version.database_url, aws_secretsmanager_secret_version.app_db_url]

  cpu    = 1024
  memory = 2048
}

output "platform_url" {
  value = module.platform.platform_url
}

output "platform_database_endpoint" {
  value = module.platform_database.endpoint
}

output "app_database_endpoint" {
  value = module.app_database.endpoint
}

output "cluster_name" {
  value = module.platform.cluster_name
}

output "certificate_validation_records" {
  value = module.platform.certificate_validation_records
}

output "cloudfront_domain" {
  value = module.platform.cloudfront_domain
}
