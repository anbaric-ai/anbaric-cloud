import {QueueMessage} from "anbaric-tsapi";
import {Pool} from "pg";
import {ConfirmableQueue} from "./ConfirmableQueue";

const DEQUEUE_BATCH_SIZE = 100;
const LEASE_SECONDS = 30;

class PostgresQueue implements ConfirmableQueue {

    constructor(private pool : Pool) {}

    async enqueue(jobId : string, workflowId : string) : Promise<void> {
        await this.pool.query("INSERT INTO queue (job_id, workflow_id) VALUES ($1, $2)", [jobId, workflowId]);
    }

    async schedule(jobId : string, workflowId : string, due : Date) : Promise<void> {
        await this.pool.query("INSERT INTO queue (job_id, workflow_id, due) VALUES ($1, $2, $3)", [jobId, workflowId, due]);
    }

    async dequeueSome() : Promise<Array<QueueMessage>> {
        const result = await this.pool.query(
            `UPDATE queue SET leased_until = now() + interval '${LEASE_SECONDS} seconds'
             WHERE position IN (
                 SELECT position FROM queue
                 WHERE (due IS NULL OR due <= now())
                   AND (leased_until IS NULL OR leased_until < now())
                 ORDER BY (due IS NOT NULL), due, position
                 LIMIT $1
                 FOR UPDATE SKIP LOCKED
             )
             RETURNING job_id, workflow_id, due, position`,
            [DEQUEUE_BATCH_SIZE],
        );

        return result.rows
            .sort((a, b) => {
                if (!a.due && !b.due) return a.position - b.position;
                if (!a.due) return -1;
                if (!b.due) return 1;
                return a.due.getTime() - b.due.getTime() || a.position - b.position;
            })
            .map(row => ({ jobId: row.job_id, workflowId: row.workflow_id }));
    }

    async confirm(message : QueueMessage) : Promise<void> {
        await this.pool.query(
            "DELETE FROM queue WHERE job_id = $1 AND workflow_id = $2",
            [message.jobId, message.workflowId],
        );
    }

}

export { PostgresQueue }
