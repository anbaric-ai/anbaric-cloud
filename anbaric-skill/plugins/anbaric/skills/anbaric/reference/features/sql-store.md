# The SQL store

When your data is relational, Anbaric gives you a full SQL database through
`SqlStore`. Locally it's SQLite (in-memory by default); deployed, it's the
tenant's PostgreSQL in a schema shared by your apps. As always, the same code
runs in both.

## Using it

Get a store from the factory and run statements with an actor (for auditing):

```ts
import {Human, SqlStoreFactory} from "anbaric";

const actor = new Human("ada", "admin");
const sql = SqlStoreFactory.instance();

await sql.execute(actor, "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT)");
const inserted = await sql.execute(actor, "INSERT INTO notes (body) VALUES (?)", ["hello"]);  // → rows affected
const rows = await sql.query(actor, "SELECT id, body FROM notes WHERE body = ?", ["hello"]);
```

- **`query(actor, sql, params?)`** returns an array of row objects.
- **`execute(actor, sql, params?)`** runs a statement and returns the number of
  affected rows.

The actor is the **first** argument for both.

## Portable SQL and the placeholder gotcha

Write portable SQL where you can — but the two backends differ in a few places,
most notably **parameter placeholders**:

| Backend | Placeholder | When |
| --- | --- | --- |
| SQLite | `?` | local (default) |
| PostgreSQL | `$1`, `$2`, … | deployed |

```ts
// SQLite (local)
await sql.query(actor, "SELECT * FROM notes WHERE id = ?", [1]);
// PostgreSQL (deployed)
await sql.query(actor, "SELECT * FROM notes WHERE id = $1", [1]);
```

If you need to target both, branch on the environment, or keep to SQL that works
on each. (A future helper may smooth this over; for now, be aware of it.)

## Where the data lives

- **Local** — SQLite, in-memory by default. Set `ANBARIC_SQL_FILE` to persist to
  a file on disk.
- **Deployed** — PostgreSQL, in a dedicated schema (`anbaric_app_data` by
  default) shared by the tenant's apps and kept apart from the platform's own
  schemas. The platform provides the connection; you don't configure it.

Selection is by `ANBARIC_SQL_STORE_TYPE` (`sqlite` locally, `cloud`/`postgres`
deployed) — set by the platform. See [Environment and
factories](../api/environment.md) for the full list.

## Next

- [Documents and secrets](documents-and-secrets.md) — for non-relational data
- [API: Stores](../api/stores.md)
