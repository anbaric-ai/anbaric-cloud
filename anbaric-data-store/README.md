# anbaric-data-store

Schema-validated JSON document storage and secret storage for Anbaric apps,
with in-memory implementations and env-driven factories. App developers
usually install [`anbaric`](https://npmjs.com/package/anbaric), which
re-exports this package.

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

## Factories

| Factory | Env var | Default | `cloud` |
| --- | --- | --- | --- |
| `JsonStoreFactory.instance(collection, schema?)` | `ANBARIC_JSON_STORE_TYPE` | `InMemoryJsonStore` | `CloudJsonStore` |
| `SecretStoreFactory.instance()` | `ANBARIC_SECRET_STORE_TYPE` | `InMemorySecretStore` | `CloudSecretStore` |

An Anbaric platform injects `cloud` into deployed apps automatically. In
cloud mode documents live in the platform's Postgres and secrets in its
secret store (AWS Secrets Manager on the hosted platform).
