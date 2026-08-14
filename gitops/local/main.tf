terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.6"
    }
  }
}

provider "docker" {}

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

  env = [
    "ANBARIC_DATABASE_URL=postgres://anbaric:anbaric@anbaric-v2-postgres:5432/anbaric",
    "ANBARIC_HOSTING_PORT=8787",
  ]

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
