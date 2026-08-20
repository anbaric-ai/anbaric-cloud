import {DatabaseSync} from "node:sqlite";
import {Auditor, NoOpAuditor, SqlStore} from "anbaric-tsapi";

/* The local SQL backend, using Node's built-in SQLite. Defaults to an in-memory
   database (matching the other in-memory local stores); set ANBARIC_SQL_FILE to
   persist to a file. SQLite uses positional `?` placeholders. */
class SqliteSqlStore extends SqlStore {

    private db : DatabaseSync;

    constructor(auditor : Auditor = new NoOpAuditor(), path : string = process.env.ANBARIC_SQL_FILE ?? ":memory:") {
        super(auditor);
        this.db = new DatabaseSync(path);
    }

    protected async queryInternal(sql : string, parameters : Array<any>) : Promise<Array<Record<string, any>>> {
        return this.db.prepare(sql).all(...parameters) as Array<Record<string, any>>;
    }

    protected async executeInternal(sql : string, parameters : Array<any>) : Promise<number> {
        return Number(this.db.prepare(sql).run(...parameters).changes);
    }

    async close() : Promise<void> {
        this.db.close();
    }

}

export { SqliteSqlStore }
