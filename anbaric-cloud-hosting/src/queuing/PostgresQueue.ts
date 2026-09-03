import {QueueMessage} from "anbaric-tsapi";
import {Pool} from "pg";
import {RemoteQueue} from "./RemoteQueue";

const DEQUEUE_BATCH_SIZE = 100;
const LEASE_SECONDS = 30;
const MAX_ATTEMPTS = 5;

class PostgresQueue implements RemoteQueue {

    constructor(private pool : Pool) {}

    async enqueue(jobId : string, appId : string | undefined, workflowId : string) : Promise<void> {
        await this.pool.query("INSERT INTO queue (job_id, app_id, workflow_id) VALUES ($1, $2, $3)", [jobId, appId || null, workflowId]);
    }

    async schedule(jobId : string, appId : string | undefined, workflowId : string, due : Date) : Promise<void> {
        await this.pool.query("INSERT INTO queue (job_id, app_id, workflow_id, due) VALUES ($1, $2, $3, $4)", [jobId, appId || null, workflowId, due]);
    }

    async dequeueSome() : Promise<Array<QueueMessage>> {
        const result = await this.pool.query(
            `UPDATE queue SET leased_until = now() + interval '${LEASE_SECONDS} seconds'
             WHERE position IN (
                 SELECT position FROM queue
                 WHERE (due IS NULL OR due <= now())
                   AND (retry_at IS NULL OR retry_at <= now())
                   AND (leased_until IS NULL OR leased_until < now())
                 ORDER BY (due IS NOT NULL), due, position
                 LIMIT $1
                 FOR UPDATE SKIP LOCKED
             )
             RETURNING job_id, app_id, workflow_id, due, position`,
            [DEQUEUE_BATCH_SIZE],
        );

        return result.rows
            .sort((a, b) => {
                if (!a.due && !b.due) return a.position - b.position;
                if (!a.due) return -1;
                if (!b.due) return 1;
                return a.due.getTime() - b.due.getTime() || a.position - b.position;
            })
            .map(row => ({ jobId: row.job_id, appId: row.app_id ?? undefined, workflowId: row.workflow_id, position: Number(row.position) }));
    }

    async confirm(message : QueueMessage) : Promise<void> {
        if (message.position === undefined) return;
        await this.pool.query("DELETE FROM queue WHERE position = $1", [message.position]);
    }

    async debounce(message : QueueMessage) : Promise<void> {
        if (message.position === undefined) return;
        // First bounce backs off 10s (a consumer that is mid-registration is
        // ready by then); later bounces back off a minute. Clearing the lease
        // makes the row eligible again the moment retry_at passes. After enough
        // bounces the message is a genuine orphan, so it is cancelled.
        const result = await this.pool.query(
            `UPDATE queue
             SET attempts = attempts + 1,
                 retry_at = now() + (CASE WHEN attempts = 0 THEN interval '10 seconds' ELSE interval '1 minute' END),
                 leased_until = NULL
             WHERE position = $1
             RETURNING attempts`,
            [message.position],
        );
        if (Number(result.rows[0]?.attempts) >= MAX_ATTEMPTS) await this.cancel(message);
    }

    async cancel(message : QueueMessage) : Promise<void> {
        console.warn(`Cancelling undeliverable queue message for job "${message.jobId}" (workflow "${message.workflowId}")`);
        if (message.position === undefined) return;
        await this.pool.query("DELETE FROM queue WHERE position = $1", [message.position]);
    }

    async size() : Promise<number> {
        const result = await this.pool.query("SELECT count(*)::int AS count FROM queue");
        return result.rows[0].count;
    }

}

export { PostgresQueue }
