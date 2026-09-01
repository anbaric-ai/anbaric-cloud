import {Pool} from "pg";
import {AppAware, Auditor, currentAppId, SqlStore} from "anbaric-tsapi";

/* The cloud SQL backend. Each deployed app gets its own dedicated schema in the
   tenant's PostgreSQL, named after the app (from getAppId(), i.e. the
   environment) - kept apart from the platform's own schemas and from other
   apps'. The schema can be overridden in the constructor. It is ensured on
   first use and set as the search_path for every connection. PostgreSQL uses
   numbered `$1, $2` placeholders. */
class PostgresSqlStore extends SqlStore implements AppAware {

    private pool : Pool;
    private ready? : Promise<void>;
    private schema : string;

    constructor(auditor : Auditor,
                connectionString : string = process.env.ANBARIC_SQL_DATABASE_URL ?? "",
                schema? : string) {

        super(auditor);

        // Default to a schema named after the app; app names allow hyphens,
        // which aren't valid in an unquoted SQL identifier, so map them to "_".
        const resolved = schema ?? currentAppId().replace(/-/g, "_");
        if (!/^[a-z_][a-z0-9_]*$/i.test(resolved)) throw new Error(`Invalid SQL schema name "${resolved}"`);

        this.schema = resolved;
        this.pool = new Pool({ connectionString });
        this.pool.on("connect", client => client.query(`SET search_path TO ${this.schema}`));
    }

    getAppId() : string {
        return currentAppId();
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
