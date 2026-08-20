terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.6"
    }
  }
}

provider "docker" {}

variable "authenticator" {
  description = "Authenticator for the local platform: empty (no auth), \"stub\" (fixed local identity), or a module name"
  type        = string
  default     = ""
}

variable "tenant" {
  type    = string
  default = "local"
}

resource "docker_network" "anbaric" {
  name = "anbaric-v2-local"
}

resource "docker_image" "postgres" {
  name = "postgres:17"
}

resource "docker_container" "postgres" {
  name  = "anbaric-v2-postgres"
  image = docker_image.postgres.image_id

  networks_advanced {
    name = docker_network.anbaric.name
  }

  env = [
    "POSTGRES_USER=anbaric",
    "POSTGRES_PASSWORD=anbaric",
    "POSTGRES_DB=anbaric",
  ]

  ports {
    internal = 5432
    external = 5433
  }
}

resource "terraform_data" "platform_image" {
  triggers_replace = timestamp()

  provisioner "local-exec" {
    command = "docker build -t anbaric-v2-platform:local -f ../../anbaric-cloud-hosting/Dockerfile ../.."
  }
}

resource "docker_container" "platform" {
  name  = "anbaric-v2-platform"
  image = "anbaric-v2-platform:local"

  lifecycle {
    replace_triggered_by = [terraform_data.platform_image]
  }

  networks_advanced {
    name = docker_network.anbaric.name
  }

  env = concat([
    "ANBARIC_DATABASE_URL=postgres://anbaric:anbaric@anbaric-v2-postgres:5432/anbaric",
    "ANBARIC_HOSTING_PORT=8787",
    "ANBARIC_INTERNAL_PORT=8788",
    "ANBARIC_BUILD_LAYER=docker",
    "ANBARIC_APP_BASE_IMAGE=anbaric-v2-platform:local",
    "ANBARIC_DOCKER_NETWORK=anbaric-v2-local",
    "ANBARIC_PLATFORM_INTERNAL_URL=http://anbaric-v2-platform:8788",
    # Shared app SQL store: the platform creates the scoped anbaric_app role with
    # this password, and hands deployed app containers the matching URL so they
    # share one anbaric_app_data schema in the local Postgres.
    "ANBARIC_APP_DB_PASSWORD=anbaricapp",
    "ANBARIC_APP_SQL_DATABASE_URL=postgres://anbaric_app:anbaricapp@anbaric-v2-postgres:5432/anbaric",
    ], var.authenticator == "" ? [] : [
    "ANBARIC_AUTHENTICATOR=${var.authenticator}",
    "ANBARIC_TENANT=${var.tenant}",
    "ANBARIC_PLATFORM_PUBLIC_URL=http://localhost:8787",
  ])

  volumes {
    host_path      = "/var/run/docker.sock"
    container_path = "/var/run/docker.sock"
  }

  ports {
    internal = 8787
    external = 8787
  }

  restart    = "on-failure"
  depends_on = [docker_container.postgres]
}

output "platform_url" {
  value = "http://localhost:8787"
}
