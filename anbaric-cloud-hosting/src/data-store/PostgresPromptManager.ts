import {Pool} from "pg";
import {JsonSchema, Prompt, PromptManager, samePromptContent} from "anbaric-tsapi";

const COLUMNS = "app_id, prompt_id, version, instructions, output_schema, created_at";

const rowToPrompt = (row : any) : Prompt => ({
    appId: row.app_id,
    promptId: row.prompt_id,
    version: row.version,
    instructions: row.instructions,
    outputSchema: row.output_schema ?? undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
});

/* Saving reads the latest version and writes the next inside one transaction,
   with the latest row locked, so two saves of the same prompt cannot both
   claim the same version number. */
class PostgresPromptManager implements PromptManager {

    constructor(private pool : Pool, private appId : string) {}

    async save(promptId : string, instructions : string, outputSchema? : JsonSchema) : Promise<Prompt> {
        const client = await this.pool.connect();

        try {
            await client.query("BEGIN");
            const latest = await client.query(
                `SELECT ${COLUMNS} FROM prompts WHERE app_id = $1 AND prompt_id = $2
                 ORDER BY version DESC LIMIT 1 FOR UPDATE`, [this.appId, promptId]);
            const current = latest.rows[0] && rowToPrompt(latest.rows[0]);

            if (current && samePromptContent(current, instructions, outputSchema)) {
                await client.query("COMMIT");
                return current;
            }

            const inserted = await client.query(
                `INSERT INTO prompts (app_id, prompt_id, version, instructions, output_schema)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING ${COLUMNS}`,
                [this.appId, promptId, (current?.version ?? 0) + 1, instructions,
                 outputSchema === undefined ? null : JSON.stringify(outputSchema)]);
            await client.query("COMMIT");
            return rowToPrompt(inserted.rows[0]);
        } catch (error) {
            await client.query("ROLLBACK").catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    async retrieve(promptId : string, version? : number) : Promise<Prompt> {
        const result = version === undefined
            ? await this.pool.query(
                `SELECT ${COLUMNS} FROM prompts WHERE app_id = $1 AND prompt_id = $2 ORDER BY version DESC LIMIT 1`,
                [this.appId, promptId])
            : await this.pool.query(
                `SELECT ${COLUMNS} FROM prompts WHERE app_id = $1 AND prompt_id = $2 AND version = $3`,
                [this.appId, promptId, version]);
        if (! result.rows[0]) {
            throw new Error(version === undefined
                ? `No prompt found with id "${promptId}"`
                : `No prompt found with id "${promptId}" at version ${version}`);
        }
        return rowToPrompt(result.rows[0]);
    }

    async list() : Promise<Array<Prompt>> {
        const result = await this.pool.query(
            `SELECT DISTINCT ON (prompt_id) ${COLUMNS} FROM prompts
             WHERE app_id = $1 ORDER BY prompt_id, version DESC`, [this.appId]);
        return result.rows.map(rowToPrompt);
    }

    async history(promptId : string) : Promise<Array<Prompt>> {
        const result = await this.pool.query(
            `SELECT ${COLUMNS} FROM prompts WHERE app_id = $1 AND prompt_id = $2 ORDER BY version DESC`,
            [this.appId, promptId]);
        return result.rows.map(rowToPrompt);
    }

}

export { PostgresPromptManager }
