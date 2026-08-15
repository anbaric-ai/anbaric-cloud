# anbaric-cloud-hosting

The Anbaric platform library: the hosted API, authentication middleware,
build layers, dispatcher and app proxy. To *run* a platform, install
[`anbaric-hosting`](https://npmjs.com/package/anbaric-hosting), which boots
this package with the `anbaric-hosting` command; this README documents the
moving parts for anyone extending the platform.

## Anatomy

**`HostingServer`** serves two node:http listeners:

- **Public** (`ANBARIC_HOSTING_PORT`, default 8787): `/ping` is open; the
  CLI-authorization poll is open by design (it delivers a one-time key);
  everything else runs through the middleware chain — bearer-token
  authentication when an `Authorization: Bearer` header is present, session
  authentication otherwise, then `authorize()`, then the `Router`.
- **Internal** (`ANBARIC_INTERNAL_PORT`, default 8788): no authentication,
  hard-whitelisted to the workflow resources (`jobs`, `queue`, `consumers`,
  `state-machines`, `documents`, `secrets`) — everything else 404s before
  the Router is consulted. Deployed apps use it; it must never be publicly
  reachable.

**`Router`** routes: `/jobs`, `/queue/{enqueue,schedule,dequeue,confirm}`,
`/consumers` (registration), `/apps` (+ `/apps/<name>/deploy`),
`/state-machines`, `/documents/<collection>`, `/secrets`, `/whoami`,
`/keys`, `/authorize-cli/<id>`, the built platform pages (dashboard at `/`,
`/manage-keys`), and finally proxies `/<app-name>/*` to running apps.

## Authentication

**`Authenticator`** (abstract): `authenticate(session, request, response)`
returns `Promise<[User, Tenant] | undefined>` — implementations write the
redirect/401 themselves and return undefined when unauthenticated.
`authorize(user, request, response)` defaults to permit. Plugins load via
`ANBARIC_AUTHENTICATOR` naming a module with a `createAuthenticator()`
export.

**`TokenAuthenticator`** verifies the CLI's EdDSA JWTs: `kid` header names a
stored key, the signature is checked against its public key, `exp` against
the clock; the request proceeds as the key's user. Keys are minted by
**`CliAuthorizer`** during the browser authorization flow and stored (with
client name, user and the session's tenant) in the `anbaric_system` schema —
system tables never mix with workflow data.

## Build layers

`BuildLayer` implementations receive the deploy tarball, bake an image from
the generated Dockerfile (base image + app source; no `npm install`, no
build step — apps run as TypeScript via tsx) and run the app:

- **`DockerBuildLayer`** (`ANBARIC_BUILD_LAYER=docker`): local docker
  daemon, one container per app on a shared network.
- **`FargateBuildLayer`** (`fargate`): uploads the bundle to S3, bakes with
  CodeBuild, runs each app as its own single-task ECS service with a Cloud
  Map DNS name. Configured by the `ANBARIC_AWS_*` variables (cluster,
  subnets, app security group, namespace id/name, apps ECR repository,
  build bucket, CodeBuild project, base image, app execution role, apps log
  group); the repository's `gitops/modules/anbaric-platform-aws` provisions
  every piece.

Deploys are asynchronous: `deploy` returns a `building` summary immediately
and the CLI polls `/apps/<name>` until `running` (liveness-probed) or
`failed`, streaming the build log.

## Queueing

`PostgresQueue` implements at-least-once delivery with 30-second leases
(`FOR UPDATE SKIP LOCKED`); `confirm` deletes. The `Dispatcher` drains the
queue on an interval and POSTs message batches to each workflow's registered
consumer URL, re-enqueueing anything unroutable or failed. Consumer
registrations are in-memory — the platform runs as a single instance until
they are persisted.

Postgres schema management is automatic on boot (`ensureSchema`): workflow
tables in `public`, platform tables in `anbaric_system`.
