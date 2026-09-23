variable "name" {
  description = "Short name for this cluster, e.g. \"staging-platform\" or \"staging-apps\""
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  description = "At least two subnets, in different availability zones"
  type        = list(string)
}

variable "master_password" {
  type      = string
  sensitive = true
}

variable "allowed_cidr_blocks" {
  description = "Cell ranges permitted to reach Postgres, arriving over peering"
  type        = list(string)
  default     = []
}

variable "allowed_security_group_ids" {
  description = "Security groups permitted to reach Postgres from inside this VPC"
  type        = list(string)
  default     = []
}

variable "database_name" {
  description = "The initial database. A shared cluster keeps \"postgres\" and gains one database per tenant; a single-tenant install names its own"
  type        = string
  default     = "postgres"
}

variable "instance_class" {
  type    = string
  default = "db.t4g.small"
}

variable "allocated_storage" {
  type    = number
  default = 20
}

variable "max_allocated_storage" {
  description = "Storage autoscaling ceiling; a shared cluster should grow on its own rather than fill up"
  type        = number
  default     = 200
}

variable "max_connections" {
  description = "Tenants in the cluster times each platform's pool size, with headroom"
  type        = string
  default     = "500"
}

/* Pinned together on purpose: leave the engine version to RDS and it picks
   whatever major is current, which then refuses the parameter group family
   named here. */
variable "engine_version" {
  type    = string
  default = "18"
}

variable "parameter_group_family" {
  type    = string
  default = "postgres18"
}

variable "backup_retention_days" {
  type    = number
  default = 7
}

variable "skip_final_snapshot" {
  description = "A shared cluster holds every tenant's data, so it takes a final snapshot by default"
  type        = bool
  default     = false
}
