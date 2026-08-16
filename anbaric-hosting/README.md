# anbaric-hosting

Run your own Anbaric platform. This package re-exports
[`anbaric-cloud-hosting`](https://npmjs.com/package/anbaric-cloud-hosting)
(the platform library) and provides the `anbaric-hosting` command that boots
the full service: the public API and pages, the internal entry point for
apps, the queue dispatcher, and the app build layer.

```bash
npm install -g anbaric-hosting
ANBARIC_DATABASE_URL=postgres://user:pass@host:5432/anbaric anbaric-hosting
```

The platform is configured entirely through environment variables:

| Variable | Purpose | Default |
| --- | --- | --- |
| `ANBARIC_DATABASE_URL` | Postgres connection string (jobs, documents, queue, system tables) | — required |
| `ANBARIC_HOSTING_PORT` | public entry point (auth-walled: API, dashboard, app proxy) | `8787` |
| `ANBARIC_INTERNAL_PORT` | internal entry point (unauthenticated workflow APIs; never expose publicly) | `8788` |
| `ANBARIC_PLATFORM_PUBLIC_URL` | public URL, used for login callbacks | `http://localhost:8787` |
| `ANBARIC_PLATFORM_INTERNAL_URL` | how deployed apps reach the internal entry point | `http://localhost:<internal port>` |
| `ANBARIC_TENANT` | tenant this platform serves (returned to the CLI on login) | — |
| `ANBARIC_BUILD_LAYER` | `docker` (needs a docker socket) or `fargate` (AWS); unset disables app deployment | unset |
| `ANBARIC_AUTHENTICATOR` | `stub`, or the module name of an auth plugin exposing `createAuthenticator()` | unset (auth disabled) |
| `ANBARIC_STUB_USER` | the fixed identity the stub authenticator signs everyone in as | `local-admin` |
| `ANBARIC_CLI_KEY_LOOKUP_URL` / `_SECRET` | verify CLI keys against a central key registry instead of the local database (hosted-platform feature; self-hosts leave unset) | unset (keys local) |
| `ANBARIC_APPS_DIR` | working directory for app bundles | `/tmp/anbaric-apps` |
| `ANBARIC_DISPATCH_INTERVAL_MS` | queue dispatch interval | `1000` |

With `ANBARIC_BUILD_LAYER=docker`: `ANBARIC_APP_BASE_IMAGE`,
`ANBARIC_DOCKER_NETWORK`. With `fargate`: the `ANBARIC_AWS_*` set (cluster,
subnets, security group, Cloud Map namespace, ECR repository, S3 build
bucket, CodeBuild project, base image, app execution role, log group) —
see the [`anbaric-cloud-hosting`](https://npmjs.com/package/anbaric-cloud-hosting)
README for the full table and the reference OpenTofu that provisions it all.

**The two entry points matter for security.** The public port serves
everything behind session/token authentication. The internal port serves
*only* the workflow resources (`jobs`, `queue`, `consumers`,
`state-machines`, `documents`, `secrets`, `/ping`) with no authentication —
it must only ever be reachable by deployed apps (same docker network, same
task, or a security-group rule).

Health check: `GET /ping` → `{"status":"ok"}` on both ports.

## The self-host flow

Self-hosting is deliberately simple — one platform, everything local, no
external control plane:

1. **Domain**: run on `localhost`, or put the platform behind your own
   domain/TLS (a reverse proxy or the reference AWS setup in the repo's
   `gitops/`); set `ANBARIC_PLATFORM_PUBLIC_URL` accordingly.
2. **Authentication — three choices**:
   - **Unset**: no auth at all. Every request is anonymous; fine on a
     trusted network or laptop.
   - **`ANBARIC_AUTHENTICATOR=stub`**: every request is authenticated as one
     fixed identity with no credential check — the whole auth-dependent
     surface (`/whoami`, CLI keys, the dashboard) works without an identity
     provider. Development only: anyone who can reach the platform *is* that
     user.
   - **Your own provider**: publish or vendor a module exporting
     `createAuthenticator() : Authenticator` — `authenticate` returns
     `[User, Tenant]` for a valid session and writes its own redirect/401
     otherwise — and name it in `ANBARIC_AUTHENTICATOR`. Any OIDC/SAML/
     anything provider fits behind that contract.
3. **CLI access**: `anbaric login`, choose Other and enter your platform
   URL. The browser authorization, keypair issuance, key storage and
   verification all happen on your platform — no central service involved.
   `ANBARIC_TENANT` is an optional label your platform reports to the CLI
   ("Logged into tenant X"); leave it unset for a single-tenant install.

Anbaric Cloud (the hosted product) layers central login, organizations and
edge routing on top of exactly this platform — none of it lives in the open
source packages, and none of it is needed to self-host.
