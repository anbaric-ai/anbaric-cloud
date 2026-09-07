import {JobRunSchedulePersistence, ScheduledRun} from "anbaric-tsapi";

type PlannedRun = ScheduledRun & { claimed : boolean };

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
        const due = this.runs.filter(run => !run.claimed && run.runAt.getTime() <= at.getTime());
        for (const run of due) run.claimed = true;
        return due.map(({ appId, workflowId, runAt }) => ({ appId, workflowId, runAt }));
    }

    private alreadyPlanned(run : ScheduledRun) : boolean {
        return this.runs.some(planned =>
            planned.appId === run.appId
            && planned.workflowId === run.workflowId
            && planned.runAt.getTime() === run.runAt.getTime());
    }

}

export { InMemoryJobRunSchedulePersistence };
