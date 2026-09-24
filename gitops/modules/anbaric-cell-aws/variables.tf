variable "name" {
  description = "Short, DNS-label-safe name for this cell; every resource is named anbaric-<name>-*"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{0,20}$", var.name))
    error_message = "name must be lower-case alphanumeric with hyphens, at most 21 characters."
  }
}

variable "cidr_block" {
  description = "The cell's VPC range. Cells must not overlap each other or the control plane they peer with"
  type        = string
  default     = "10.30.0.0/16"
}

variable "subnet_newbits" {
  description = "Bits added to the VPC prefix for each subnet; 4 over a /16 gives /20s, which is what a cell full of tenants needs"
  type        = number
  default     = 4
}

variable "peer_vpc_id" {
  description = "VPC to peer with, so tenants can reach the shared database clusters; empty creates no peering"
  type        = string
  default     = ""
}

variable "peer_cidr_block" {
  description = "The peer VPC's range, routed from this cell's subnets"
  type        = string
  default     = ""
}
