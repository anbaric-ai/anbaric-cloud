# anbaric-data-store

Schema-validated JSON document storage, secret storage, and a relational (SQL)
store for Anbaric apps, with local implementations and env-driven factories.
App developers usually install [`anbaric`](https://npmjs.com/package/anbaric),
which re-exports this package.

## Documents

```ts
import {JsonStoreFactory} from "anbaric-data-store";
import type {Actor} from "anbaric-tsapi";

const customers = JsonStoreFactory.instance("customers", {
    type: "object",
    required: ["name"],
    properties: { name: { type: "string" }, email: { type: "string" } },
});

// Every store call records the acting actor for the audit trail.
const actor : Actor = { type: "CODE", id: "seed-script", role: "admin" };

await customers.create(actor, "ada", { name: "Ada", email: "ada@example.com" });
await customers.save(actor, "corrected email", "ada", { name: "Ada", email: "ada@corp.example" });
const ada = await customers.retrieve("ada", actor);   // throws No document found with id "x" when absent
const all = await customers.list(actor);              // returns document values, not ids
await customers.delete("ada", actor);
```

The first argument is the collection name; collections are independent. The
optional second argument is a `JsonSchema` (subset: `type`, `properties`,
`required`, `items`, `enum`) — documents failing it are rejected on `create`/`save`
with a `failed schema validation` error before anything is stored.

## Secrets

```ts
import {SecretStoreFactory} from "anbaric-data-store";

const secrets = SecretStoreFactory.instance();
await secrets.create(actor, "api-key", "s3cr3t");
const key = await secrets.retrieve("api-key", actor);
```

## SQL

A relational store for structured app data. Locally it is backed by SQLite (an
in-memory database by default); once deployed, every app in a tenant shares one
dedicated PostgreSQL schema (`anbaric_app_data`), kept apart from the platform's
own schemas by a scoped database role.

```ts
import {SqlStoreFactory} from "anbaric-data-store";

const sql = SqlStoreFactory.instance();

await sql.execute(actor, "CREATE TABLE IF NOT EXISTS notes (id SERIAL PRIMARY KEY, body TEXT)");
await sql.execute(actor, "INSERT INTO notes (body) VALUES ($1)", ["hello"]);   // SQLite: VALUES (?)
const rows = await sql.query(actor, "SELECT id, body FROM notes WHERE body = $1", ["hello"]);
```

`query` returns the rows; `execute` returns the number of affected rows. Both
record the interaction (`QUERY` / `EXECUTE`) for the audit trail.

**SQLite (local) vs PostgreSQL (cloud).** The backends are close but not
identical — write portable SQL, or target the one you deploy to:

| | SQLite (local) | PostgreSQL (cloud) |
| --- | --- | --- |
| Parameter placeholders | positional `?` | numbered `$1, $2` |
| Auto-increment key | `INTEGER PRIMARY KEY` | `SERIAL` / `GENERATED … AS IDENTITY` |
| Column types | dynamic (`TEXT`/`INTEGER`/`REAL`/`BLOB`) | static and rich (`JSONB`, `TIMESTAMPTZ`, …) |
| Booleans | `0` / `1` | native `boolean` |
| Persistence | in-memory unless `ANBARIC_SQL_FILE` is set | durable, shared across the tenant's apps |

## Factories

| Factory | Env var | Default | `cloud` |
| --- | --- | --- | --- |
| `JsonStoreFactory.instance(collection, schema?)` | `ANBARIC_JSON_STORE_TYPE` | `InMemoryJsonStore` | `CloudJsonStore` |
| `SecretStoreFactory.instance()` | `ANBARIC_SECRET_STORE_TYPE` | `InMemorySecretStore` | `CloudSecretStore` |
| `SqlStoreFactory.instance()` | `ANBARIC_SQL_STORE_TYPE` | `SqliteSqlStore` | `PostgresSqlStore` |

An Anbaric platform injects `cloud` into deployed apps automatically. In cloud
mode documents live in the platform's Postgres and secrets in its secret store
(AWS Secrets Manager on the hosted platform); the SQL store connects directly to
the tenant's Postgres, in its own `anbaric_app_data` schema.
