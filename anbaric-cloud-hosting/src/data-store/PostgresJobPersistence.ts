import {Auditor, Job, JobPersistence, NoOpAuditor, SerializedWaitForInput, deserializeJob, serializeWaitForInput} from "anbaric-tsapi";
import {Pool} from "pg";

type JobRow = {
    id : string,
    state : string,
    properties : Record<string, any>,
    workflow_id? : string,
    app_id? : string,
    started_at : Date,
    started_by : string,
    last_updated : Date,
    killed : boolean,
    status : string,
    waiting_for? : string,
    await_metadata? : SerializedWaitForInput,
};

/* The await a job is parked on is normalised into the awaits table: jobs
   carry a waiting_for foreign key, the metadata lives once in awaits, and the
   job's awaitMetadata is rejoined on read. */
const JOB_SELECT =
    `SELECT j.id, j.state, j.properties, j.workflow_id, j.app_id, j.started_at, j.started_by, j.last_updated,
            j.killed, j.status, j.waiting_for, a.metadata AS await_metadata
     FROM jobs j LEFT JOIN awaits a ON a.id = j.waiting_for`;

class PostgresJobPersistence extends JobPersistence {

    constructor(private pool : Pool, auditor : Auditor = new NoOpAuditor()) {
        super(auditor);
    }

    protected async saveInternal(job : Job) : Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");

            const previous = await client.query("SELECT waiting_for FROM jobs WHERE id = $1", [job.id]);
            const previousAwait : string | null = previous.rows[0]?.waiting_for ?? null;

            if (job.waitingFor) {
                await client.query(
                    `INSERT INTO awaits (id, metadata) VALUES ($1, $2)
                     ON CONFLICT (id) DO UPDATE SET metadata = EXCLUDED.metadata`,
                    [job.waitingFor, job.awaitMetadata ? serializeWaitForInput(job.awaitMetadata) : {}],
                );
            }

            await client.query(
                `INSERT INTO jobs (id, state, properties, workflow_id, app_id, started_at, started_by, last_updated, killed, status, waiting_for)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, properties = EXCLUDED.properties,
                     workflow_id = EXCLUDED.workflow_id, app_id = EXCLUDED.app_id, last_updated = EXCLUDED.last_updated,
                     killed = EXCLUDED.killed, status = EXCLUDED.status, waiting_for = EXCLUDED.waiting_for`,
                [job.id, job.state, Object.fromEntries(job.properties), job.workflowId, job.appId || null,
                    job.startedAt, job.startedBy, job.lastUpdated, job.killed, job.status, job.waitingFor ?? null],
            );

            // The await the job has left is no longer referenced - drop its metadata.
            if (previousAwait && previousAwait !== job.waitingFor) {
                await client.query("DELETE FROM awaits WHERE id = $1", [previousAwait]);
            }

            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    protected async retrieveInternal(id : string) : Promise<Job> {
        const result = await this.pool.query(`${JOB_SELECT} WHERE j.id = $1`, [id]);
        if (result.rowCount === 0) throw new Error(`No job found with id "${id}"`);

        return this.deserializeRow(result.rows[0]);
    }

    protected async deleteInternal(id : string) : Promise<void> {
        await this.pool.query("DELETE FROM jobs WHERE id = $1", [id]);
    }

    protected async listInternal(pageSize : number = 100, page : number = 0) : Promise<Array<Job>> {
        const result = await this.pool.query(
            `${JOB_SELECT} ORDER BY j.inserted_at LIMIT $1 OFFSET $2`,
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
            appId: row.app_id ?? undefined,
            startedAt: row.started_at.toISOString(),
            startedBy: row.started_by,
            lastUpdated: row.last_updated.toISOString(),
            killed: row.killed,
            status: row.status,
            waitingFor: row.waiting_for ?? undefined,
            awaitMetadata: row.await_metadata ?? undefined,
        });
    }

}

export { PostgresJobPersistence }
