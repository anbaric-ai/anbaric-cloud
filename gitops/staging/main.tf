terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # backend "s3" {
  #   bucket = "anbaric-tofu-state"
  #   key    = "staging/terraform.tfstate"
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

variable "auth0_organization" {
  type    = string
  default = ""
}

variable "platform_public_url" {
  type    = string
  default = ""
}

variable "platform_domain" {
  type    = string
  default = ""
}

variable "tenant" {
  type    = string
  default = ""
}

module "platform" {
  source = "../modules/anbaric-platform-aws"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment = "staging"
  aws_region  = var.aws_region
  source_root = "${path.root}/../.."
  db_password = var.db_password

  auth0_domain        = var.auth0_domain
  auth0_client_id     = var.auth0_client_id
  auth0_client_secret = var.auth0_client_secret
  auth0_organization  = var.auth0_organization
  platform_public_url = var.platform_public_url
  platform_domain     = var.platform_domain
  tenant              = var.tenant
}

output "platform_url" {
  value = module.platform.platform_url
}

output "database_endpoint" {
  value = module.platform.database_endpoint
}

output "bastion_instance_id" {
  value = module.platform.bastion_instance_id
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
