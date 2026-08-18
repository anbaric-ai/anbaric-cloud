import {Auditor, JsonStore, NoOpAuditor} from "anbaric-tsapi";
import {Pool} from "pg";

class PostgresJsonStore extends JsonStore {

    constructor(private pool : Pool, collection : string, auditor : Auditor = new NoOpAuditor()) {
        super(auditor, collection);
    }

    protected async saveInternal(id : string, document : any) : Promise<void> {
        await this.pool.query(
            `INSERT INTO documents (collection, id, document) VALUES ($1, $2, $3)
             ON CONFLICT (collection, id) DO UPDATE SET document = EXCLUDED.document`,
            [this.collection, id, document],
        );
    }

    protected async retrieveInternal(id : string) : Promise<any> {
        const result = await this.pool.query(
            "SELECT document FROM documents WHERE collection = $1 AND id = $2",
            [this.collection, id],
        );
        if (result.rowCount === 0) throw new Error(`No document found with id "${id}"`);

        return result.rows[0].document;
    }

    protected async deleteInternal(id : string) : Promise<void> {
        await this.pool.query("DELETE FROM documents WHERE collection = $1 AND id = $2", [this.collection, id]);
    }

    protected async listInternal(pageSize : number = 100, page : number = 0) : Promise<Array<any>> {
        const result = await this.pool.query(
            "SELECT document FROM documents WHERE collection = $1 ORDER BY inserted_at LIMIT $2 OFFSET $3",
            [this.collection, pageSize, page * pageSize],
        );

        return result.rows.map(row => row.document);
    }

}

export { PostgresJsonStore }
