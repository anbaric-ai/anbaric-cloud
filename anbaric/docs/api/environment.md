# API — Environment and factories

Anbaric never hard-wires a backend. Persistence, queueing, stores and auditing
come from **factories** that read `ANBARIC_*` environment variables. With none
set, everything is in-memory and the app runs in one process; the platform sets
them to `cloud` when your app is deployed.

> **Don't set the factory `*_TYPE` variables yourself.** The platform injects
> them so the same code runs locally and deployed. Setting them by hand breaks
> that guarantee.

## The golden rule

```ts
// This is all your code does — the factory decides the implementation:
const machine = new StateMachine("onboarding", states);
const sql = SqlStoreFactory.instance();
```

Locally: in-memory persistence, queue and stores; console auditing.
Deployed: the same calls talk to the platform.

## Factory variables

Each factory switches on a `*_TYPE` variable (typically `cloud` when deployed,
defaulting to a local implementation otherwise).

| Variable | Selects | Local default |
| --- | --- | --- |
| `ANBARIC_JOB_PERSISTENCE_TYPE` | where jobs are stored | in-memory |
| `ANBARIC_QUEUE_TYPE` | the job queue | in-memory |
| `ANBARIC_AUDITOR_TYPE` | the audit sink (`cloud` → platform) | console |
| `ANBARIC_JSON_STORE_TYPE` | the JSON document store | in-memory |
| `ANBARIC_SECRET_STORE_TYPE` | the secret store | in-memory (encrypted) |
| `ANBARIC_SQL_STORE_TYPE` | the SQL store (`sqlite` / `cloud`\|`postgres`) | SQLite |
| `ANBARIC_SESSION_RESOLVER_TYPE` | how `Human.fromSession` resolves sessions | in-memory |

## Store configuration

Used by the store implementations the factories return:

| Variable | Used by | Meaning |
| --- | --- | --- |
| `ANBARIC_SQL_FILE` | SQLite | file path to persist to (default `:memory:`) |
| `ANBARIC_SQL_DATABASE_URL` | PostgreSQL | connection string |
| `ANBARIC_SQL_SCHEMA` | PostgreSQL | schema name (default `anbaric_app_data`) |

## Platform-injected variables

When your app is deployed, the platform also sets these — informational; **don't
set or depend on their exact values**:

| Variable | Meaning |
| --- | --- |
| `PORT` | the port your app should listen on |
| `ANBARIC_APP_ID` | your app's name; scopes your workflows, documents and secrets |
| `ANBARIC_CLOUD_URL` | the platform endpoint the cloud clients call |
| `ANBARIC_ADMIN_PORT` | the built-in admin/liveness port |
| `ANBARIC_CONSUMER_PORT` / `ANBARIC_CONSUMER_URL` | job-consumer wiring |

## Local development

With no variables set you get the full in-memory stack — no database, no
platform. Run your entry file directly with `tsx`:

```bash
npx tsx src/main.ts
```

To persist SQL data across local runs, set a file:

```bash
ANBARIC_SQL_FILE=./dev.db npx tsx src/main.ts
```

## See also

- [Stores](stores.md) — the store APIs and their variables
- [Deploying](../features/deploying.md) — what the platform injects
