import {Auditor, JsonStore, NoOpAuditor} from "anbaric-tsapi";
import {Pool} from "pg";

/* Documents are keyed by the composite (app_id, collection, id): the owning app,
   the collection and the document id, so ids never collide across apps. */
class PostgresJsonStore extends JsonStore {

    constructor(private pool : Pool, private appId : string, collection : string, auditor : Auditor = new NoOpAuditor()) {
        super(auditor, collection);
    }

    protected async saveInternal(id : string, document : any) : Promise<void> {
        await this.pool.query(
            `INSERT INTO documents (app_id, collection, id, document) VALUES ($1, $2, $3, $4)
             ON CONFLICT (app_id, collection, id) DO UPDATE SET document = EXCLUDED.document`,
            [this.appId, this.collection, id, document],
        );
    }

    protected async retrieveInternal(id : string) : Promise<any> {
        const result = await this.pool.query(
            "SELECT document FROM documents WHERE app_id = $1 AND collection = $2 AND id = $3",
            [this.appId, this.collection, id],
        );
        if (result.rowCount === 0) throw new Error(`No document found with id "${id}"`);

        return result.rows[0].document;
    }

    protected async deleteInternal(id : string) : Promise<void> {
        await this.pool.query("DELETE FROM documents WHERE app_id = $1 AND collection = $2 AND id = $3",
            [this.appId, this.collection, id]);
    }

    protected async listInternal(pageSize : number = 100, page : number = 0) : Promise<Array<any>> {
        const result = await this.pool.query(
            "SELECT document FROM documents WHERE app_id = $1 AND collection = $2 ORDER BY inserted_at LIMIT $3 OFFSET $4",
            [this.appId, this.collection, pageSize, page * pageSize],
        );

        return result.rows.map(row => row.document);
    }

}

export { PostgresJsonStore }
