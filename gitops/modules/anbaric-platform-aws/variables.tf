variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "image" {
  description = "Container image for the platform service (ECR URI with tag)"
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
  default = 256
}

variable "memory" {
  type    = number
  default = 512
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "hosting_port" {
  type    = number
  default = 8787
}
