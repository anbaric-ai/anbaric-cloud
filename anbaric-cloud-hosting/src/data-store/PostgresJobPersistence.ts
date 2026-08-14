import {Job, JobPersistence, deserializeJob} from "anbaric-tsapi";
import {Pool} from "pg";

class PostgresJobPersistence implements JobPersistence {

    constructor(private pool : Pool) {}

    async save(job : Job) : Promise<void> {
        await this.pool.query(
            `INSERT INTO jobs (id, state, properties, workflow_id) VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, properties = EXCLUDED.properties, workflow_id = EXCLUDED.workflow_id`,
            [job.id, job.stateId, Object.fromEntries(job.properties), job.workflowId],
        );
    }

    async retrieve(id : string) : Promise<Job> {
        const result = await this.pool.query(
            "SELECT id, state, properties, workflow_id FROM jobs WHERE id = $1",
            [id],
        );
        if (result.rowCount === 0) throw new Error(`No job found with id "${id}"`);

        return this.deserializeRow(result.rows[0]);
    }

    async delete(id : string) : Promise<void> {
        await this.pool.query("DELETE FROM jobs WHERE id = $1", [id]);
    }

    async list(pageSize : number = 100, page : number = 0) : Promise<Array<Job>> {
        const result = await this.pool.query(
            "SELECT id, state, properties, workflow_id FROM jobs ORDER BY inserted_at LIMIT $1 OFFSET $2",
            [pageSize, page * pageSize],
        );

        return result.rows.map(row => this.deserializeRow(row));
    }

    private deserializeRow(row : { id : string, state : string, properties : Record<string, any>, workflow_id? : string }) : Job {
        return deserializeJob({ ...row, workflowId: row.workflow_id ?? undefined });
    }

    async updateProperties(id : string, properties : Map<string, any>) : Promise<void> {
        const result = await this.pool.query(
            "UPDATE jobs SET properties = properties || $2::jsonb WHERE id = $1",
            [id, Object.fromEntries(properties)],
        );
        if (result.rowCount === 0) throw new Error(`No job found with id "${id}"`);
    }

}

export { PostgresJobPersistence }
