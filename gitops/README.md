# Anbaric gitops

OpenTofu environments for the Anbaric platform (the `anbaric-cloud-hosting` service plus its Postgres database).

## Layout

- `local/` — runs the platform on Docker Desktop: a `postgres:17` container and the platform image built from the monorepo's `anbaric-cloud-hosting/Dockerfile`. The platform listens on `http://localhost:8787`.
- `staging/` — AWS: Fargate service + RDS Postgres via the shared module, small sizing.
- `prod/` — AWS: same module, bigger database and two service replicas.
- `modules/anbaric-platform-aws/` — shared module: RDS Postgres, ECS cluster/task/service on Fargate, security groups, log group. Deliberately basic (default VPC, public service IP, no ALB or per-tenant stacks yet).

## Usage

```sh
cd gitops/local        # or staging / prod
tofu init
tofu apply             # staging/prod need -var image=... and -var db_password=...
```

Local expects Docker Desktop to be running. Staging and prod expect AWS credentials in the environment, an image pushed to ECR, and an S3 state backend configured (see the commented `backend` block) before the first shared apply.

An app connects to a platform with:

```sh
ANBARIC_JOB_PERSISTENCE_TYPE=cloud
ANBARIC_QUEUE_TYPE=cloud
ANBARIC_CONSUMER_TYPE=cloud
ANBARIC_CLOUD_URL=http://localhost:8787   # the platform URL
ANBARIC_CONSUMER_URL=http://host.docker.internal:8788   # how the platform reaches the app back
```
