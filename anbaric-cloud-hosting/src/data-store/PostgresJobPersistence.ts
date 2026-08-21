import {Auditor, Job, JobPersistence, NoOpAuditor, deserializeJob} from "anbaric-tsapi";
import {Pool} from "pg";

type JobRow = {
    id : string,
    state : string,
    properties : Record<string, any>,
    workflow_id? : string,
    started_at : Date,
    started_by : string,
    last_updated : Date,
    killed : boolean,
};

const JOB_COLUMNS = "id, state, properties, workflow_id, started_at, started_by, last_updated, killed";

class PostgresJobPersistence extends JobPersistence {

    constructor(private pool : Pool, auditor : Auditor = new NoOpAuditor()) {
        super(auditor);
    }

    protected async saveInternal(job : Job) : Promise<void> {
        await this.pool.query(
            `INSERT INTO jobs (id, state, properties, workflow_id, started_at, started_by, last_updated, killed)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, properties = EXCLUDED.properties,
                 workflow_id = EXCLUDED.workflow_id, last_updated = EXCLUDED.last_updated, killed = EXCLUDED.killed`,
            [job.id, job.state, Object.fromEntries(job.properties), job.workflowId,
                job.startedAt, job.startedBy, job.lastUpdated, job.killed],
        );
    }

    protected async retrieveInternal(id : string) : Promise<Job> {
        const result = await this.pool.query(
            `SELECT ${JOB_COLUMNS} FROM jobs WHERE id = $1`,
            [id],
        );
        if (result.rowCount === 0) throw new Error(`No job found with id "${id}"`);

        return this.deserializeRow(result.rows[0]);
    }

    protected async deleteInternal(id : string) : Promise<void> {
        await this.pool.query("DELETE FROM jobs WHERE id = $1", [id]);
    }

    protected async listInternal(pageSize : number = 100, page : number = 0) : Promise<Array<Job>> {
        const result = await this.pool.query(
            `SELECT ${JOB_COLUMNS} FROM jobs ORDER BY inserted_at LIMIT $1 OFFSET $2`,
            [pageSize, page * pageSize],
        );

        return result.rows.map(row => this.deserializeRow(row));
    }

    protected async killInternal(id : string) : Promise<void> {
        await this.pool.query("UPDATE jobs SET killed = true, last_updated = now() WHERE id = $1", [id]);
    }

    protected async killOlderThanInternal(lastUpdatedBefore : Date) : Promise<number> {
        const result = await this.pool.query(
            "UPDATE jobs SET killed = true, last_updated = now() WHERE last_updated < $1 AND killed = false",
            [lastUpdatedBefore],
        );
        return result.rowCount ?? 0;
    }

    protected async countByStateInternal() : Promise<Array<JobPersistence.StateCount>> {
        const result = await this.pool.query(
            "SELECT state, killed, count(*)::int AS count FROM jobs GROUP BY state, killed",
        );
        return result.rows.map(row => ({ state: row.state, killed: row.killed, count: row.count }));
    }

    private deserializeRow(row : JobRow) : Job {
        return deserializeJob({
            ...row,
            workflowId: row.workflow_id ?? undefined,
            startedAt: row.started_at.toISOString(),
            startedBy: row.started_by,
            lastUpdated: row.last_updated.toISOString(),
            killed: row.killed,
        });
    }

}

export { PostgresJobPersistence }
