import {Queue} from "anbaric-tsapi";
import {Pool} from "pg";

const DEQUEUE_BATCH_SIZE = 100;

class PostgresQueue implements Queue {

    constructor(private pool : Pool) {}

    async enqueue(jobId : string) : Promise<void> {
        await this.pool.query("INSERT INTO queue (job_id) VALUES ($1)", [jobId]);
    }

    async schedule(jobId : string, due : Date) : Promise<void> {
        await this.pool.query("INSERT INTO queue (job_id, due) VALUES ($1, $2)", [jobId, due]);
    }

    async dequeueSome() : Promise<Array<string>> {
        const result = await this.pool.query(
            `DELETE FROM queue WHERE position IN (
                 SELECT position FROM queue
                 WHERE due IS NULL OR due <= now()
                 ORDER BY (due IS NOT NULL), due, position
                 LIMIT $1
                 FOR UPDATE SKIP LOCKED
             )
             RETURNING job_id, due, position`,
            [DEQUEUE_BATCH_SIZE],
        );

        return result.rows
            .sort((a, b) => {
                if (!a.due && !b.due) return a.position - b.position;
                if (!a.due) return -1;
                if (!b.due) return 1;
                return a.due.getTime() - b.due.getTime() || a.position - b.position;
            })
            .map(row => row.job_id);
    }

}

export { PostgresQueue }
