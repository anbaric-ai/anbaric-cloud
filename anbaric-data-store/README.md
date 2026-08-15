# anbaric-data-store

Schema-validated JSON document storage and secret storage for Anbaric apps,
with in-memory implementations and env-driven factories. App developers
usually install [`anbaric`](https://npmjs.com/package/anbaric), which
re-exports this package.

## Documents

```ts
import {JsonStoreFactory} from "anbaric-data-store";

const customers = JsonStoreFactory.instance("customers", {
    type: "object",
    required: ["name"],
    properties: { name: { type: "string" }, email: { type: "string" } },
});

await customers.save("ada", { name: "Ada", email: "ada@example.com" });
const ada = await customers.retrieve("ada");   // throws No document found with id "x" when absent
const all = await customers.list();
await customers.delete("ada");
```

The first argument is the collection name; collections are independent. The
optional second argument is a `JsonSchema` (subset: `type`, `properties`,
`required`, `items`, `enum`) — documents failing it are rejected on `save`
with a `failed schema validation` error before anything is stored.

## Secrets

```ts
import {SecretStoreFactory} from "anbaric-data-store";

const secrets = SecretStoreFactory.instance();
await secrets.save("api-key", "s3cr3t");
const key = await secrets.retrieve("api-key");
```

## Factories

| Factory | Env var | Default | `cloud` |
| --- | --- | --- | --- |
| `JsonStoreFactory.instance(collection, schema?)` | `ANBARIC_JSON_STORE_TYPE` | `InMemoryJsonStore` | `CloudJsonStore` |
| `SecretStoreFactory.instance()` | `ANBARIC_SECRET_STORE_TYPE` | `InMemorySecretStore` | `CloudSecretStore` |

An Anbaric platform injects `cloud` into deployed apps automatically. In
cloud mode documents live in the platform's Postgres and secrets in its
secret store (AWS Secrets Manager on the hosted platform).
