terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.6"
    }
  }
}

provider "docker" {}

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
    "ANBARIC_BUILD_LAYER=docker",
    "ANBARIC_APP_BASE_IMAGE=anbaric-v2-platform:local",
    "ANBARIC_DOCKER_NETWORK=anbaric-v2-local",
    "ANBARIC_PLATFORM_INTERNAL_URL=http://anbaric-v2-platform:8787",
    ], var.auth0_domain == "" ? [] : [
    "ANBARIC_AUTHENTICATOR=anbaric-cloud-hosting-auth-auth0",
    "ANBARIC_AUTH0_DOMAIN=${var.auth0_domain}",
    "ANBARIC_AUTH0_CLIENT_ID=${var.auth0_client_id}",
    "ANBARIC_AUTH0_CLIENT_SECRET=${var.auth0_client_secret}",
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
