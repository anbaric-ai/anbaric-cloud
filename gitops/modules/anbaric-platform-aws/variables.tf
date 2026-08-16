variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "source_root" {
  description = "Path to the monorepo root; the platform image is built from it and pushed on apply"
  type        = string
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "cpu" {
  type    = number
  default = 512
}

variable "memory" {
  type    = number
  default = 1024
}

variable "hosting_port" {
  type    = number
  default = 8787
}

variable "internal_port" {
  type    = number
  default = 8788
}

variable "auth0_domain" {
  description = "Auth0 tenant domain (empty disables authentication)"
  type        = string
  default     = ""
}

variable "auth0_client_id" {
  description = "Auth0 application client id for the platform's login flow"
  type        = string
  default     = ""
}

variable "auth0_client_secret" {
  description = "Auth0 application client secret for the platform's login flow"
  type        = string
  default     = ""
  sensitive   = true
}

variable "auth0_organization" {
  description = "Auth0 Organization (id or name slug) this tenant's logins are scoped to"
  type        = string
  default     = ""
}

variable "edge" {
  description = "own: this stack runs its own CloudFront distribution (self-host default). shared: a central distribution routes to this stack's ALB, so no CloudFront/ACM/domain resources are created."
  type        = string
  default     = "own"

  validation {
    condition     = contains(["own", "shared"], var.edge)
    error_message = "edge must be \"own\" or \"shared\"."
  }
}

variable "platform_image" {
  description = "Externally built platform image URI; empty builds the image from source_root"
  type        = string
  default     = ""
}

variable "build_image" {
  description = "Build and push the platform image from source_root on apply; set false when platform_image is supplied"
  type        = bool
  default     = true
}

variable "extra_environment" {
  description = "Additional environment variables for the platform task"
  type        = map(string)
  default     = {}
}

variable "tenant" {
  description = "Tenant this stack serves (returned to the CLI during login)"
  type        = string
  default     = ""
}

variable "platform_domain" {
  description = "Custom domain for the platform (e.g. staging.cloud.anbaric.ai); empty serves from the CloudFront domain"
  type        = string
  default     = ""
}

variable "platform_public_url" {
  description = "Public URL of the platform, used for the login callback; defaults to the CloudFront domain"
  type        = string
  default     = ""
}

variable "extra_pull_repository_arns" {
  description = "Additional ECR repositories the app build may pull from (e.g. an externally supplied base image)"
  type        = list(string)
  default     = []
}
