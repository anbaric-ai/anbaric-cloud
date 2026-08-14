import {Job, JobPersistence, JobTransition, deserializeJob} from "anbaric-tsapi";
import {Pool} from "pg";

type JobRow = {
    id : string,
    state : string,
    properties : Record<string, any>,
    workflow_id? : string,
    started_at : Date,
    started_by : string,
    last_updated : Date,
    transitions : Array<JobTransition>,
};

const JOB_COLUMNS = "id, state, properties, workflow_id, started_at, started_by, last_updated, transitions";

class PostgresJobPersistence implements JobPersistence {

    constructor(private pool : Pool) {}

    async save(job : Job) : Promise<void> {
        await this.pool.query(
            `INSERT INTO jobs (id, state, properties, workflow_id, started_at, started_by, last_updated, transitions)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, properties = EXCLUDED.properties,
                 workflow_id = EXCLUDED.workflow_id, last_updated = EXCLUDED.last_updated,
                 transitions = EXCLUDED.transitions`,
            [job.id, job.stateId, Object.fromEntries(job.properties), job.workflowId,
                job.startedAt, job.startedBy, job.lastUpdated, JSON.stringify(job.transitions)],
        );
    }

    async retrieve(id : string) : Promise<Job> {
        const result = await this.pool.query(
            `SELECT ${JOB_COLUMNS} FROM jobs WHERE id = $1`,
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
            `SELECT ${JOB_COLUMNS} FROM jobs ORDER BY inserted_at LIMIT $1 OFFSET $2`,
            [pageSize, page * pageSize],
        );

        return result.rows.map(row => this.deserializeRow(row));
    }

    private deserializeRow(row : JobRow) : Job {
        return deserializeJob({
            ...row,
            workflowId: row.workflow_id ?? undefined,
            startedAt: row.started_at.toISOString(),
            startedBy: row.started_by,
            lastUpdated: row.last_updated.toISOString(),
            transitions: row.transitions,
        });
    }

    async updateProperties(id : string, properties : Map<string, any>) : Promise<void> {
        const result = await this.pool.query(
            "UPDATE jobs SET properties = properties || $2::jsonb, last_updated = now() WHERE id = $1",
            [id, Object.fromEntries(properties)],
        );
        if (result.rowCount === 0) throw new Error(`No job found with id "${id}"`);
    }

}

export { PostgresJobPersistence }
