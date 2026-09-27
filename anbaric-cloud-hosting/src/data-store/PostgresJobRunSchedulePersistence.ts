import {JobRunSchedulePersistence, ScheduledRun} from "anbaric-tsapi";
import {Pool} from "pg";

const CLAIM_BATCH_SIZE = 100;

/* The shared store behind the job run scheduler. Claiming is one statement
   over rows selected FOR UPDATE SKIP LOCKED, so several schedulers can point
   at one database and each due run is handed to exactly one of them - no run
   started twice, none lost to a scheduler that dies mid-claim.

   Within that statement a machine's overdue runs are coalesced: the most
   recent is claimed and the earlier ones are marked superseded by it, with
   the row that replaced them, so a backlog never becomes a burst of jobs and
   the record says why a tick started nothing. The batch limit bounds machines,
   not rows: every due row of a chosen machine is settled in the same claim,
   or a later tick would find the leftovers and start one of them. */
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
            `WITH machines AS (
                 SELECT app_id, workflow_id
                 FROM job_run_schedule
                 WHERE claimed_at IS NULL AND superseded_at IS NULL AND run_at <= $1
                 GROUP BY app_id, workflow_id
                 ORDER BY min(run_at)
                 LIMIT $2
             ),
             due AS (
                 SELECT s.id, s.app_id, s.workflow_id, s.run_at
                 FROM job_run_schedule s
                 JOIN machines m ON m.app_id = s.app_id AND m.workflow_id = s.workflow_id
                 WHERE s.claimed_at IS NULL AND s.superseded_at IS NULL AND s.run_at <= $1
                 FOR UPDATE OF s SKIP LOCKED
             ),
             ranked AS (
                 SELECT id, first_value(id) OVER (PARTITION BY app_id, workflow_id ORDER BY run_at DESC, id DESC) AS latest
                 FROM due
             ),
             superseded AS (
                 UPDATE job_run_schedule s SET superseded_at = now(), superseded_by = r.latest
                 FROM ranked r WHERE s.id = r.id AND r.id <> r.latest
             )
             UPDATE job_run_schedule s SET claimed_at = now()
             FROM ranked r WHERE s.id = r.id AND r.id = r.latest
             RETURNING s.app_id, s.workflow_id, s.run_at`,
            [at, CLAIM_BATCH_SIZE],
        );
        result.rows.sort((left, right) => left.run_at.getTime() - right.run_at.getTime());

        return result.rows.map(row => ({
            appId: row.app_id ?? "",
            workflowId: row.workflow_id,
            runAt: row.run_at,
        }));
    }

}

export { PostgresJobRunSchedulePersistence }
