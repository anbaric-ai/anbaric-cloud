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

variable "redeployment_trigger" {
  description = "Changing this value rolls the platform service; used when the image is built externally"
  type        = string
  default     = ""
}

variable "additional_services_image" {
  description = "Container image for the shared additional-services instance in this cluster; empty disables it"
  type        = string
  default     = ""
}

variable "additional_services_api_key_secret_arn" {
  description = "Secrets Manager ARN of the additional-services bearer API key (shared by the platform and the service)"
  type        = string
  default     = ""
}

variable "additional_services_ai_gateway_token_secret_arn" {
  description = "Secrets Manager ARN of the OpenAI-compatible gateway token used by additional-services"
  type        = string
  default     = ""
}

variable "additional_services_browserless_token_secret_arn" {
  description = "Secrets Manager ARN of the Browserless API token used by additional-services /html; empty leaves /html unauthenticated"
  type        = string
  default     = ""
}

variable "additional_services_ai_gateway_url" {
  description = "OpenAI-compatible base URL additional-services calls (e.g. the Cloudflare AI Gateway /compat endpoint)"
  type        = string
  default     = ""
}

variable "additional_services_agentic_model" {
  description = "Model id additional-services requests (e.g. openai/gpt-4o-mini via a gateway, or gpt-4o-mini direct)"
  type        = string
  default     = ""
}

variable "ai_gateway_token_secret_arn" {
  description = "Secrets Manager ARN of the OpenAI-compatible gateway token the platform itself uses (doc generation); empty leaves the platform's LLM features off"
  type        = string
  default     = ""
}

variable "ai_gateway_url" {
  description = "OpenAI-compatible base URL the platform calls for its own LLM features (doc generation)"
  type        = string
  default     = ""
}

variable "agentic_model" {
  description = "Model id the platform requests for its own LLM features (doc generation)"
  type        = string
  default     = ""
}

variable "deploy_additional_services" {
  description = "Whether to run the shared additional-services instance in this cluster"
  type        = bool
  default     = false
}

variable "enable_bastion" {
  description = "Run a keyless SSM bastion for reaching the private database from a laptop (Session Manager port forwarding; no inbound SSH)"
  type        = bool
  default     = false
}
