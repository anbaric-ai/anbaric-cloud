# Documents and secrets

Not all data belongs to a job. For standalone records and sensitive values,
Anbaric provides two stores, obtained from factories and used with an actor so
every access is audited. Like everything else, they're in-memory locally and
platform-backed once deployed — no code change.

## The JSON document store

`JsonStore` keeps JSON documents in a named **collection**, optionally validated
against a JSON Schema you pass to the factory.

```ts
import {Human, JsonStoreFactory, type JsonSchema} from "anbaric";

const actor = new Human("ada", "admin");

const schema : JsonSchema = {
    type: "object",
    required: ["name"],
    properties: { name: { type: "string" }, tier: { type: "string" } },
};

const customers = JsonStoreFactory.instance("customers", schema);

await customers.create(actor, "ada", { name: "Ada", tier: "gold" });
const record = await customers.retrieve("ada", actor);
await customers.save(actor, "Upgraded tier", "ada", { name: "Ada", tier: "platinum" });
const page = await customers.list(actor, 20, 0);   // pageSize, page
await customers.delete("ada", actor);
```

Documents that fail the schema are rejected. Retrieving an unknown id throws
`No document found with id "..."`.

> **Note the actor position.** `create`, `save` and `list` take the actor
> **first**; `retrieve` and `delete` take it **last**. `save` also takes a change
> description (for the audit trail) between the actor and the id. See the
> [API reference](../api/stores.md) for exact signatures.

## The secret store

`SecretStore` holds named secret strings, encrypted at rest, and **never records
secret values** in the audit trail. `list` returns names only.

```ts
import {SecretStoreFactory} from "anbaric";

const secrets = SecretStoreFactory.instance();

await secrets.create(actor, "stripe-key", "sk_live_...");
const key = await secrets.retrieve("stripe-key", actor);
const names = await secrets.list(actor);       // ["stripe-key", ...] — names only
await secrets.delete("stripe-key", actor);
```

Use the secret store for third-party API keys and other credentials your app
needs at runtime. Retrieving an unknown name throws `No secret found with name
"..."`.

## Choosing an implementation

You don't — the factories do, from the environment:

| Store | Factory | Env var | Local default | Deployed |
| --- | --- | --- | --- | --- |
| Documents | `JsonStoreFactory.instance(collection, schema?)` | `ANBARIC_JSON_STORE_TYPE` | in-memory | platform (`cloud`) |
| Secrets | `SecretStoreFactory.instance()` | `ANBARIC_SECRET_STORE_TYPE` | in-memory (encrypted) | platform (`cloud`) |

The platform sets these variables when your app is deployed. Don't set them
yourself. See [Environment and factories](../api/environment.md).

## Everything is scoped to your app

Deployed, documents and secrets are **owned by your app**: a collection or secret
name is private to the app that wrote it, so two apps can use the same collection
and ids without ever colliding or seeing each other's data. You don't do
anything to get this — the platform scopes every read and write to your app
automatically.

## Next

- [The SQL store](sql-store.md) — a relational database for structured data
- [API: Stores](../api/stores.md)
