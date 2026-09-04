# API — Stores

Standalone storage for data that doesn't live on a job. Every method takes an
**actor** for auditing. Get instances from the factories; the environment selects
the in-memory or platform-backed implementation.

```ts
import {JsonStoreFactory, SecretStoreFactory, SqlStoreFactory, type JsonSchema} from "anbaric";
```

> **Actor argument position is not uniform.** For `JsonStore`/`SecretStore`,
> `create`/`save`/`list` take the actor **first**, but `retrieve`/`delete` take
> it **last**. `SqlStore` takes the actor first everywhere. The signatures below
> are exact.

---

## `JsonStore`

Schema-validated JSON documents in a named collection.

```ts
JsonStoreFactory.instance(collection : string, schema? : JsonSchema) : JsonStore

// methods:
create(actor : Actor, id : string, document : any) : Promise<void>
save(actor : Actor, changeDescription : string, id : string, document : any) : Promise<void>
retrieve(id : string, actor : Actor) : Promise<any>
delete(id : string, actor : Actor) : Promise<void>
list(actor : Actor, pageSize? : number, page? : number) : Promise<Array<any>>
```

```ts
const customers = JsonStoreFactory.instance("customers", {
    type: "object", required: ["name"], properties: { name: { type: "string" } },
});
await customers.create(actor, "ada", { name: "Ada" });
await customers.save(actor, "Renamed", "ada", { name: "Ada Lovelace" });
const doc  = await customers.retrieve("ada", actor);
const page = await customers.list(actor, 20, 0);
await customers.delete("ada", actor);
```

- Documents that fail the schema are rejected.
- `retrieve` of an unknown id throws `No document found with id "..."`.
- Env var: **`ANBARIC_JSON_STORE_TYPE`** (`cloud` deployed; in-memory otherwise).

### `JsonSchema`

```ts
type JsonSchema = {
    type? : "object" | "array" | "string" | "number" | "integer" | "boolean" | "null",
    properties? : Record<string, JsonSchema>,
    required? : Array<string>,
    items? : JsonSchema,
    enum? : Array<any>,
}
```

---

## `SecretStore`

Named secret strings, encrypted at rest. Values are never audited; `list`
returns names only.

```ts
SecretStoreFactory.instance() : SecretStore

// methods:
create(actor : Actor, name : string, value : string) : Promise<void>
save(actor : Actor, changeDescription : string, name : string, value : string) : Promise<void>
retrieve(name : string, actor : Actor) : Promise<string>
delete(name : string, actor : Actor) : Promise<void>
list(actor : Actor) : Promise<Array<string>>
```

```ts
const secrets = SecretStoreFactory.instance();
await secrets.create(actor, "stripe-key", "sk_live_...");
const key = await secrets.retrieve("stripe-key", actor);
```

- `retrieve` of an unknown name throws `No secret found with name "..."`.
- Env var: **`ANBARIC_SECRET_STORE_TYPE`** (`cloud` deployed; in-memory otherwise).

---

## `SqlStore`

A relational database — SQLite locally, PostgreSQL deployed.

```ts
SqlStoreFactory.instance() : SqlStore

// methods:
query(actor : Actor, sql : string, parameters? : Array<any>) : Promise<Array<Record<string, any>>>
execute(actor : Actor, sql : string, parameters? : Array<any>) : Promise<number>   // rows affected
close() : Promise<void>
```

```ts
const sql = SqlStoreFactory.instance();
await sql.execute(actor, "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT)");
await sql.execute(actor, "INSERT INTO notes (body) VALUES (?)", ["hello"]);
const rows = await sql.query(actor, "SELECT * FROM notes WHERE body = ?", ["hello"]);
```

- **Placeholders differ:** SQLite uses `?`, PostgreSQL uses `$1, $2, …`.
- Env vars: **`ANBARIC_SQL_STORE_TYPE`** (`sqlite` local / `cloud`|`postgres`
  deployed), **`ANBARIC_SQL_FILE`** (SQLite file path; default in-memory),
  **`ANBARIC_SQL_DATABASE_URL`** and **`ANBARIC_SQL_SCHEMA`** (Postgres). Set by
  the platform.

---

### See also

- [Documents and secrets](../features/documents-and-secrets.md)
- [The SQL store](../features/sql-store.md)
- [Environment and factories](environment.md)
