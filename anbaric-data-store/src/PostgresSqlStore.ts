import {Pool} from "pg";
import {Auditor, SqlStore} from "anbaric-tsapi";

/* The cloud SQL backend. All apps in a tenant share one dedicated schema
   (ANBARIC_SQL_SCHEMA, default anbaric_app_data) in the tenant's PostgreSQL,
   kept apart from the platform's own schemas. The schema is ensured on first
   use and set as the search_path for every connection. PostgreSQL uses
   numbered `$1, $2` placeholders. */
class PostgresSqlStore extends SqlStore {

    private pool : Pool;
    private ready? : Promise<void>;
    private schema : string;

    constructor(auditor : Auditor,
                connectionString : string = process.env.ANBARIC_SQL_DATABASE_URL ?? "",
                schema : string = process.env.ANBARIC_SQL_SCHEMA ?? "anbaric_app_data") {
        super(auditor);
        if (!/^[a-z_][a-z0-9_]*$/i.test(schema)) throw new Error(`Invalid SQL schema name "${schema}"`);
        this.schema = schema;
        this.pool = new Pool({ connectionString });
        this.pool.on("connect", client => client.query(`SET search_path TO ${this.schema}`));
    }

    /* Created on first use, not in the constructor, so the store can be built
       without opening a connection. */
    private ensureReady() : Promise<void> {
        return this.ready ??= this.pool.query(`CREATE SCHEMA IF NOT EXISTS ${this.schema}`).then(() => undefined);
    }

    protected async queryInternal(sql : string, parameters : Array<any>) : Promise<Array<Record<string, any>>> {
        await this.ensureReady();
        return (await this.pool.query(sql, parameters)).rows;
    }

    protected async executeInternal(sql : string, parameters : Array<any>) : Promise<number> {
        await this.ensureReady();
        return (await this.pool.query(sql, parameters)).rowCount ?? 0;
    }

    async close() : Promise<void> {
        await this.pool.end();
    }

}

export { PostgresSqlStore }
