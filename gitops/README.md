# Anbaric gitops

OpenTofu environments for the Anbaric platform (the `anbaric-cloud-hosting` service plus its Postgres database).

## Layout

- `local/` — runs the platform on Docker Desktop: a `postgres:17` container and the platform image built from the monorepo's `anbaric-cloud-hosting/Dockerfile`. The platform listens on `http://localhost:8787`.
- `staging/` — AWS via the shared module, small sizing.
- `prod/` — AWS: same module, bigger database and task.
- `modules/anbaric-platform-aws/` — the full AWS estate, created from nothing: a dedicated VPC (two public subnets, internet gateway), RDS Postgres (private, security-group access only), an ECR repository with the platform image built and pushed on `apply` whenever the source changes, a Fargate service health-checked on `/ping` behind an ALB that only admits CloudFront's origin-facing IPs, secrets in Secrets Manager, CloudWatch logs, and a CloudFront distribution in front of everything.

Both AWS environments default to **eu-west-3 (Paris)** — the lowest-latency region for the UK outside eu-west-1/eu-west-2, which host the existing Anbaric v1 estate; a validation rule refuses those two regions outright.

On AWS the platform uses its Fargate build layer: `anbaric deploy` uploads the app bundle, the platform ships it to S3 and has CodeBuild bake the image (the same generated Dockerfile as local, from the platform base image) into the apps ECR repository, then runs the app as its own single-task ECS service. Apps get Cloud Map DNS names (`<app>.anbaric-<env>.local`) that the proxy and dispatcher use, and reach the platform's internal entry point at `platform.anbaric-<env>.local:8788` — a port only the app security group can reach. Expect AWS deploys to take a few minutes (CodeBuild spin-up); the CLI polls status as usual. Consumer registrations are in-memory, so the platform is pinned to a single task until they are persisted.

CloudFront terminates TLS at the edge and follows the origin's `Cache-Control` headers — the platform currently marks nothing cacheable (everything sits behind the session/token wall), so requests pass through today, and edge caching switches on per-response as soon as the platform emits `Cache-Control`.

## Usage

```sh
cd gitops/local        # or staging / prod
tofu init
tofu apply
```

Local expects Docker Desktop to be running. Staging and prod expect AWS credentials and docker in the environment (the image build/push happens during `apply`), a `db_password` in `terraform.tfvars`, and an S3 state backend configured (see the commented `backend` block) before the first shared apply. The `platform_url` output — the CloudFront domain unless `platform_public_url` overrides it with a custom domain — is the platform address, and with Auth0 enabled `<platform_url>/callback` must be added to the Auth0 application's Allowed Callback URLs.

Environment-specific configuration (Auth0 tenants, AWS settings) is supplied per environment via a gitignored `terraform.tfvars` — never commit tenant ids, domains, or credentials to this repo:

```hcl
# gitops/<env>/terraform.tfvars (gitignored)
auth0_domain        = "your-tenant.eu.auth0.com"
auth0_client_id     = "your Auth0 application client id"
auth0_client_secret = "your Auth0 application client secret"
```

When `auth0_domain` is set, the platform boots with `ANBARIC_AUTHENTICATOR=anbaric-cloud-hosting-auth-auth0` and every resource (except `/ping`) requires a login session: browsers are redirected to the tenant's login page and return via `<platform>/callback`, which must be listed in the Auth0 application's Allowed Callback URLs (for local: `http://localhost:8787/callback`). When unset, authentication is disabled (local dev default).

An app connects to a platform with:

```sh
ANBARIC_JOB_PERSISTENCE_TYPE=cloud
ANBARIC_QUEUE_TYPE=cloud
ANBARIC_CONSUMER_TYPE=cloud
ANBARIC_CLOUD_URL=http://localhost:8787   # the platform URL
ANBARIC_CONSUMER_URL=http://host.docker.internal:8788   # how the platform reaches the app back
```
