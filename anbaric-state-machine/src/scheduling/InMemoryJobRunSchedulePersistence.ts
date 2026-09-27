import {JobRunSchedulePersistence, ScheduledRun} from "anbaric-tsapi";

type PlannedRun = ScheduledRun & { claimed : boolean, supersededBy? : ScheduledRun };

class InMemoryJobRunSchedulePersistence implements JobRunSchedulePersistence {

    private runs : Array<PlannedRun> = [];

    async highWaterMark(appId : string, workflowId : string) : Promise<Date | undefined> {
        const times = this.runs
            .filter(run => run.appId === appId && run.workflowId === workflowId)
            .map(run => run.runAt.getTime());
        return times.length === 0 ? undefined : new Date(Math.max(...times));
    }

    async plan(runs : Array<ScheduledRun>) : Promise<void> {
        for (const run of runs) {
            if (this.alreadyPlanned(run)) continue;
            this.runs.push({ ...run, claimed: false });
        }
    }

    async claimDue(at : Date) : Promise<Array<ScheduledRun>> {
        const due = this.runs.filter(run => !run.claimed && !run.supersededBy && run.runAt.getTime() <= at.getTime());
        const latestPerMachine = new Map<string, PlannedRun>();

        for (const run of due) {
            const key = this.key(run);
            const latest = latestPerMachine.get(key);
            if (!latest || run.runAt.getTime() > latest.runAt.getTime()) latestPerMachine.set(key, run);
        }
        for (const run of due) {
            const latest = latestPerMachine.get(this.key(run))!;
            if (run === latest) run.claimed = true;
            else run.supersededBy = this.publicShape(latest);
        }

        return [...latestPerMachine.values()]
            .sort((left, right) => left.runAt.getTime() - right.runAt.getTime())
            .map(run => this.publicShape(run));
    }

    // The runs that were passed over in favour of a later one, for anyone
    // asking why a tick did not start a job.
    superseded() : Array<{ run : ScheduledRun, by : ScheduledRun }> {
        return this.runs
            .filter(run => run.supersededBy)
            .map(run => ({ run: this.publicShape(run), by: run.supersededBy! }));
    }

    private alreadyPlanned(run : ScheduledRun) : boolean {
        return this.runs.some(planned =>
            planned.appId === run.appId
            && planned.workflowId === run.workflowId
            && planned.runAt.getTime() === run.runAt.getTime());
    }

    private key(run : ScheduledRun) : string {
        return JSON.stringify([run.appId, run.workflowId]);
    }

    private publicShape({ appId, workflowId, runAt } : ScheduledRun) : ScheduledRun {
        return { appId, workflowId, runAt };
    }

}

export { InMemoryJobRunSchedulePersistence };
