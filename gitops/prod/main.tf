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

module "platform" {
  source = "../modules/anbaric-platform-aws"

  environment       = "prod"
  aws_region        = var.aws_region
  image             = var.image
  db_password       = var.db_password
  db_instance_class = "db.t4g.small"
  desired_count     = 2
}

output "database_endpoint" {
  value = module.platform.database_endpoint
}

output "cluster_name" {
  value = module.platform.cluster_name
}
