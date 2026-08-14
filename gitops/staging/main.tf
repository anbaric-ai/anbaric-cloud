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

module "platform" {
  source = "../modules/anbaric-platform-aws"

  environment = "staging"
  aws_region  = var.aws_region
  source_root = "${path.root}/../.."
  db_password = var.db_password

  auth0_domain        = var.auth0_domain
  auth0_client_id     = var.auth0_client_id
  auth0_client_secret = var.auth0_client_secret
  platform_public_url = var.platform_public_url
}

output "platform_url" {
  value = module.platform.platform_url
}

output "database_endpoint" {
  value = module.platform.database_endpoint
}

output "cluster_name" {
  value = module.platform.cluster_name
}
