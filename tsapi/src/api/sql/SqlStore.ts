import {Actor} from "../actors/Actor";
import {Auditor} from "../auditing/Auditor";

/* A relational (SQL) store for application data. Public methods audit the
   interaction then defer to the abstract ...Internal. `query` returns rows;
   `execute` runs a statement and returns the number of affected rows. The
   backing engine (SQLite locally, PostgreSQL in the cloud) is chosen by the
   factory; SQL placeholder syntax differs between them (see the docs). */
abstract class SqlStore {

    constructor(protected auditor : Auditor) {
    }

    async query(actor : Actor, sql : string, parameters : Array<any> = []) : Promise<Array<Record<string, any>>> {
        await this.auditor.audit("sql", "*", actor, [SqlStore.Interaction.QUERY], sql, null);
        return this.queryInternal(sql, parameters);
    }

    async execute(actor : Actor, sql : string, parameters : Array<any> = []) : Promise<number> {
        await this.auditor.audit("sql", "*", actor, [SqlStore.Interaction.EXECUTE], sql, null);
        return this.executeInternal(sql, parameters);
    }

    abstract close() : Promise<void>;

    protected abstract queryInternal(sql : string, parameters : Array<any>) : Promise<Array<Record<string, any>>>;
    protected abstract executeInternal(sql : string, parameters : Array<any>) : Promise<number>;

}

namespace SqlStore {

    export enum Interaction {
        QUERY = "QUERY",
        EXECUTE = "EXECUTE",
    }

}

export { SqlStore }
