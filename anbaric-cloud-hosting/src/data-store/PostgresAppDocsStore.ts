import {Pool} from "pg";
import {AppDoc, AppDocsStore} from "./AppDocsStore";

/* Replacing an app's docs is a delete-then-insert in one transaction, so a
   redeploy swaps the whole set atomically - a reader never sees a mix of old
   and new, and a crash mid-write leaves the previous docs intact. */
class PostgresAppDocsStore implements AppDocsStore {

    constructor(private pool : Pool) {}

    async replaceForApp(appId : string, docs : Array<AppDoc>) : Promise<void> {
        const client = await this.pool.connect();

        try {
            await client.query("BEGIN");
            await client.query("DELETE FROM app_docs WHERE app_id = $1", [appId]);

            if (docs.length > 0) {
                await client.query(
                    `INSERT INTO app_docs (app_id, slug, title, markdown)
                     SELECT $1, * FROM unnest($2::text[], $3::text[], $4::text[])`,
                    [appId, docs.map(doc => doc.slug), docs.map(doc => doc.title), docs.map(doc => doc.markdown)],
                );
            }

            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK").catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    async listForApp(appId : string) : Promise<Array<AppDoc>> {
        const result = await this.pool.query(
            "SELECT slug, title, markdown FROM app_docs WHERE app_id = $1 ORDER BY slug", [appId]);
        return result.rows.map(row => ({ slug: row.slug, title: row.title, markdown: row.markdown }));
    }

}

export { PostgresAppDocsStore }
