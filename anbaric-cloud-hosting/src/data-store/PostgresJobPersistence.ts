import {Auditor, Job, JobPersistence, JobProperties, NoOpAuditor, SerializedWaitForInput, deserializeJob, serializeWaitForInput} from "anbaric-tsapi";
import {Pool, PoolClient} from "pg";

type JobRow = {
    id : string,
    state : string,
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
    `SELECT j.id, j.state, j.workflow_id, j.app_id, j.started_at, j.started_by, j.last_updated,
            j.killed, j.status, j.waiting_for, a.metadata AS await_metadata
     FROM jobs j LEFT JOIN awaits a ON a.id = j.waiting_for`;

/* Properties live one row each in job_properties, so a read fetches only the
   keys asked for and a write upserts only the keys that changed: a job that
   holds a great deal never has all of it moved for one step. */
class PostgresJobPersistence extends JobPersistence {

    constructor(private pool : Pool, auditor : Auditor = new NoOpAuditor()) {
        super(auditor);
    }

    protected async saveInternal(job : Job, properties? : Map<string, any>) : Promise<void> {
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
                `INSERT INTO jobs (id, state, workflow_id, app_id, started_at, started_by, last_updated, killed, status, waiting_for)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 -- killed is deliberately not updated here. Only kill() sets it,
                 -- and a save carries whatever the job looked like when it was
                 -- read: a pass that began before a kill would otherwise write
                 -- killed=false straight back and bring the job back to life.
                 ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state,
                     workflow_id = EXCLUDED.workflow_id, app_id = EXCLUDED.app_id, last_updated = EXCLUDED.last_updated,
                     status = EXCLUDED.status, waiting_for = EXCLUDED.waiting_for`,
                [job.id, job.state, job.workflowId, job.appId || null,
                    job.startedAt, job.startedBy, job.lastUpdated, job.killed, job.status, job.waitingFor ?? null],
            );

            await this.upsertProperties(client, job.id, properties);

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

    private async upsertProperties(client : PoolClient, jobId : string, properties? : Map<string, any>) : Promise<void> {
        if (! properties || properties.size === 0) return;

        const entries = [...properties];
        await client.query(
            `INSERT INTO job_properties (job_id, key, value)
             SELECT $1, key, value FROM unnest($2::text[], $3::jsonb[]) AS changed (key, value)
             ON CONFLICT (job_id, key) DO UPDATE SET value = EXCLUDED.value`,
            [jobId, entries.map(([key]) => key), entries.map(([, value]) => JSON.stringify(value ?? null))],
        );
    }

    /* A job read with `keys` holds those and fetches any other property the
       moment a step asks for it, straight from its rows; a job read whole
       holds everything. */
    protected async retrieveInternal(id : string, keys? : Array<string>) : Promise<Job> {
        const result = await this.pool.query(`${JOB_SELECT} WHERE j.id = $1`, [id]);
        if (result.rowCount === 0) throw new Error(`No job found with id "${id}"`);

        const loader = async (wanted? : Array<string>) => (await this.propertiesOf([id], wanted)).get(id) ?? new Map<string, any>();
        const properties = keys
            ? new JobProperties(await loader(keys), loader, false)
            : new JobProperties(await loader());
        return this.deserializeRow(result.rows[0], properties);
    }

    /* The properties of several jobs in one query, all of them or only `keys`,
       grouped by job. An empty `keys` asks for none and costs no query. */
    private async propertiesOf(jobIds : Array<string>, keys? : Array<string>) : Promise<Map<string, Map<string, any>>> {
        const grouped = new Map<string, Map<string, any>>();
        if (jobIds.length === 0 || keys?.length === 0) return grouped;

        const result = keys
            ? await this.pool.query(
                "SELECT job_id, key, value FROM job_properties WHERE job_id = ANY($1) AND key = ANY($2)", [jobIds, keys])
            : await this.pool.query(
                "SELECT job_id, key, value FROM job_properties WHERE job_id = ANY($1)", [jobIds]);

        for (const row of result.rows) {
            const properties = grouped.get(row.job_id) ?? new Map<string, any>();
            properties.set(row.key, row.value);
            grouped.set(row.job_id, properties);
        }
        return grouped;
    }

    protected async deleteInternal(id : string) : Promise<void> {
        await this.pool.query("DELETE FROM jobs WHERE id = $1", [id]);
    }

    protected async listInternal(pageSize : number = 100, page : number = 0, query : JobPersistence.Query = {}) : Promise<Array<Job>> {
        const conditions : Array<string> = [];
        const values : Array<unknown> = [];
        const narrow = (column : string, value : unknown) => {
            if (value === undefined) return;
            values.push(value);
            conditions.push(`j.${column} = $${values.length}`);
        };
        narrow("workflow_id", query.workflowId);
        narrow("app_id", query.appId);
        narrow("state", query.state);
        narrow("status", query.status);
        narrow("killed", query.killed);

        const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
        const direction = query.order === "newest" ? "DESC" : "ASC";
        const result = await this.pool.query(
            `${JOB_SELECT}${where} ORDER BY j.inserted_at ${direction} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, pageSize, page * pageSize],
        );

        const properties = await this.propertiesOf(result.rows.map(row => row.id));
        return result.rows.map(row => this.deserializeRow(row, new JobProperties(properties.get(row.id) ?? new Map())));
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

    private deserializeRow(row : JobRow, properties : JobProperties) : Job {
        const shape = deserializeJob({
            ...row,
            properties: {},
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
        return new Job(shape.id, properties, shape.state, shape.workflowId, shape.appId, shape.startedBy, shape.startedAt,
            shape.lastUpdated, shape.killed, shape.status, shape.awaitMetadata, shape.waitingFor);
    }

}

export { PostgresJobPersistence }
