/* The delegated v2 DNS zone. anbaric.ai itself is managed in Cloudflare;
   a single NS record there for cloud.anbaric.ai (pointing at this zone's
   name servers) hands the whole subdomain to Route53, where every v2
   record - certificate validation, environments, tenants - is managed by
   tofu. */

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = "eu-west-3"
}

variable "zone_name" {
  type    = string
  default = "cloud.anbaric.ai"
}

resource "aws_route53_zone" "cloud" {
  name = var.zone_name
}

output "zone_name" {
  value = aws_route53_zone.cloud.name
}

output "name_servers" {
  description = "Add these as an NS record for cloud.anbaric.ai in Cloudflare (DNS-only)"
  value       = aws_route53_zone.cloud.name_servers
}
