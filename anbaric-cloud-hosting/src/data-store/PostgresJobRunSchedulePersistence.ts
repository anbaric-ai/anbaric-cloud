import {JobRunSchedulePersistence, ScheduledRun} from "anbaric-tsapi";
import {Pool} from "pg";

const CLAIM_BATCH_SIZE = 100;

/* The shared store behind the job run scheduler. Claiming is a single
   UPDATE ... RETURNING over rows selected FOR UPDATE SKIP LOCKED, so several
   schedulers can point at one database and each due run is handed to exactly
   one of them - no run started twice, none lost to a scheduler that dies
   mid-claim. */
class PostgresJobRunSchedulePersistence implements JobRunSchedulePersistence {

    constructor(private pool : Pool) {}

    async highWaterMark(appId : string, workflowId : string) : Promise<Date | undefined> {
        const result = await this.pool.query(
            "SELECT max(run_at) AS latest FROM job_run_schedule WHERE app_id = $1 AND workflow_id = $2",
            [appId, workflowId],
        );
        return result.rows[0]?.latest ?? undefined;
    }

    async plan(runs : Array<ScheduledRun>) : Promise<void> {
        if (runs.length === 0) return;
        await this.pool.query(
            `INSERT INTO job_run_schedule (app_id, workflow_id, run_at)
             SELECT * FROM unnest($1::text[], $2::text[], $3::timestamptz[])
             ON CONFLICT (app_id, workflow_id, run_at) DO NOTHING`,
            [runs.map(run => run.appId), runs.map(run => run.workflowId), runs.map(run => run.runAt)],
        );
    }

    async claimDue(at : Date) : Promise<Array<ScheduledRun>> {
        const result = await this.pool.query(
            `UPDATE job_run_schedule SET claimed_at = now()
             WHERE id IN (
                 SELECT id FROM job_run_schedule
                 WHERE claimed_at IS NULL AND run_at <= $1
                 ORDER BY run_at
                 LIMIT $2
                 FOR UPDATE SKIP LOCKED
             )
             RETURNING app_id, workflow_id, run_at`,
            [at, CLAIM_BATCH_SIZE],
        );

        return result.rows.map(row => ({
            appId: row.app_id ?? "",
            workflowId: row.workflow_id,
            runAt: row.run_at,
        }));
    }

}

export { PostgresJobRunSchedulePersistence }
