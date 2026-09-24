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

## `FileStorage`

Bytes at a path, with a content type. `list` returns metadata only.

```ts
FileStorageFactory.instance() : FileStorage

// methods:
put(actor : Actor, path : string, contents : Uint8Array, contentType? : string) : Promise<void>
get(path : string, actor : Actor) : Promise<StoredFile>
delete(path : string, actor : Actor) : Promise<void>
list(prefix : string, actor : Actor) : Promise<Array<StoredFileInfo>>

// types:
StoredFile     = { path, contents : Uint8Array, contentType, size, lastModified : Date }
StoredFileInfo = StoredFile without contents
```

```ts
const files = FileStorageFactory.instance();
await files.put(actor, "reports/q3.csv", bytes, "text/csv");
const report = await files.get("reports/q3.csv", actor);
```

- Paths are relative, `/`-separated, and may not contain `..`.
- `get` of an unknown path throws `No file found at "..."`.
- Env var: **`ANBARIC_FILE_STORAGE_TYPE`** (`cloud` deployed; local disk otherwise, under
  `ANBARIC_FILE_STORAGE_PATH` or the temp directory).

---

## `PromptManager`

Versioned prompts - instructions plus an optional output schema - owned by the
calling app.

```ts
PromptManagerFactory.instance() : PromptManager

// methods:
save(promptId : string, instructions : string, outputSchema? : JsonSchema) : Promise<Prompt>
retrieve(promptId : string, version? : number) : Promise<Prompt>
list() : Promise<Array<Prompt>>
history(promptId : string) : Promise<Array<Prompt>>

type Prompt = {
    appId : string, promptId : string, version : number, instructions : string,
    outputSchema? : JsonSchema, createdAt : string,
}
```

```ts
const prompts = PromptManagerFactory.instance();
await prompts.save("triage", "Decide the priority.", { type: "object", properties: { priority: { type: "string" } } });
const latest   = await prompts.retrieve("triage");      // highest version
const specific = await prompts.retrieve("triage", 1);
const all      = await prompts.list();                  // latest of each prompt
const versions = await prompts.history("triage");       // newest first
```

- `save` stores a new version only when the content differs from the latest; an identical save returns the existing version, so registering at every startup is safe.
- Versions auto-increment from 1; there is no rollback or tagging.
- `retrieve` of an unknown prompt throws `No prompt found with id "..."`.
- Env var: **`ANBARIC_PROMPT_MANAGER_TYPE`** (`cloud` deployed; in-memory otherwise).

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
