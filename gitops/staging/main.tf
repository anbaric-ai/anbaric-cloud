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
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "image" {
  description = "Container image for the platform service (ECR URI with tag)"
  type        = string
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
  image       = var.image
  db_password = var.db_password

  auth0_domain        = var.auth0_domain
  auth0_client_id     = var.auth0_client_id
  auth0_client_secret = var.auth0_client_secret
  platform_public_url = var.platform_public_url
}

output "database_endpoint" {
  value = module.platform.database_endpoint
}

output "cluster_name" {
  value = module.platform.cluster_name
}
