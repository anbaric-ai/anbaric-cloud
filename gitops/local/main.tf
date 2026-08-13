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
  name = "anbaric-local"
}

resource "docker_image" "postgres" {
  name = "postgres:17"
}

resource "docker_container" "postgres" {
  name  = "anbaric-postgres"
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
    external = 5432
  }
}

resource "docker_image" "platform" {
  name = "anbaric-platform:local"

  build {
    context    = "../.."
    dockerfile = "anbaric-cloud-hosting/Dockerfile"
  }
}

resource "docker_container" "platform" {
  name  = "anbaric-platform"
  image = docker_image.platform.image_id

  networks_advanced {
    name = docker_network.anbaric.name
  }

  env = [
    "ANBARIC_DATABASE_URL=postgres://anbaric:anbaric@anbaric-postgres:5432/anbaric",
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
