import {JobRunSchedulePersistence, ScheduledRun} from "anbaric-tsapi";
import {StateMachine} from "../StateMachine.js";
import {JobRunSchedulePersistenceFactory} from "./JobRunSchedulePersistenceFactory.js";
import {Schedule} from "./Schedule.js";

const TICK_INTERVAL_MS = 1000;
const DEFAULT_LOOKAHEAD_MS = 1000 * 60 * 60 * 24;
const DEFAULT_RUN_OFFSET_MS : [number, number] = [0, 1000 * 60 * 2];

type ScheduledMachine = {
    machine : StateMachine,
    schedule : Schedule,
    lookaheadMs : number,
    randomRunOffsetMs : [number, number],
};

/* Starts jobs on a timetable. Runs are planned ahead of time and stored, so
   the plan survives a restart and a machine that was down does not silently
   skip its runs; each tick plans further ahead and starts whatever has come
   due. Planning and starting are separate on purpose - a run is a record long
   before it is a job.

   Claiming a due run is per-process today. Before two schedulers can point at
   one store, claimDue has to become atomic in the persistence. */
class JobRunScheduler {

    private static singleton? : JobRunScheduler;

    private machines = new Map<string, ScheduledMachine>();
    private ticker? : ReturnType<typeof setInterval>;
    private ticking = false;

    constructor(private persistence : JobRunSchedulePersistence = JobRunSchedulePersistenceFactory.instance()) {}

    static instance() : JobRunScheduler {
        if (!JobRunScheduler.singleton) JobRunScheduler.singleton = new JobRunScheduler();
        return JobRunScheduler.singleton;
    }

    schedule(machine : StateMachine, at : Schedule, lookaheadMs : number = DEFAULT_LOOKAHEAD_MS,
             randomRunOffsetMs : [number, number] = DEFAULT_RUN_OFFSET_MS) : void {
        this.machines.set(this.key(machine.getAppId(), machine.workflowId),
            { machine, schedule: at, lookaheadMs, randomRunOffsetMs });
        this.start();
    }

    // Plans and starts everything owed as at `now`, without waiting for a tick.
    async tick(now : Date = new Date()) : Promise<void> {
        for (const scheduled of this.machines.values()) await this.planAhead(scheduled, now);
        await this.startDue(now);
    }

    async cleanUp() : Promise<void> {
        if (this.ticker) clearInterval(this.ticker);
        this.ticker = undefined;
        this.machines.clear();
    }

    private start() : void {
        if (this.ticker) return;
        this.ticker = setInterval(() => void this.tickOnce(), TICK_INTERVAL_MS);
        // Scheduling alone should not hold a process open.
        this.ticker.unref?.();
    }

    private async tickOnce() : Promise<void> {
        if (this.ticking) return;
        this.ticking = true;
        try {
            await this.tick();
        } catch {
            // A failing tick must not kill the timer; the next one retries.
        } finally {
            this.ticking = false;
        }
    }

    private async planAhead(scheduled : ScheduledMachine, now : Date) : Promise<void> {
        const appId = scheduled.machine.getAppId();
        const workflowId = scheduled.machine.workflowId;

        const planned = await this.persistence.highWaterMark(appId, workflowId);
        const from = planned && planned.getTime() > now.getTime() ? planned : now;
        const to = new Date(now.getTime() + scheduled.lookaheadMs);
        if (to.getTime() <= from.getTime()) return;

        const runs = scheduled.schedule.getRuns(from, to).map(runAt => ({
            appId,
            workflowId,
            runAt: this.withOffset(runAt, scheduled.randomRunOffsetMs),
        }));

        if (runs.length > 0) await this.persistence.plan(runs);
    }

    private async startDue(now : Date) : Promise<void> {
        for (const run of await this.persistence.claimDue(now)) {
            const scheduled = this.machines.get(this.key(run.appId, run.workflowId));
            if (!scheduled) continue;
            await scheduled.machine.startJob(this.propertiesFor(run));
        }
    }

    // Spreads runs that would otherwise all fire on the same second. Applied
    // when the run is planned, not when it starts, so the time that was stored
    // is the time it actually runs.
    private withOffset(runAt : Date, [lowest, highest] : [number, number]) : Date {
        if (highest <= lowest) return runAt;
        return new Date(runAt.getTime() + Math.round(Math.random() * (highest - lowest)) + lowest);
    }

    private propertiesFor(run : ScheduledRun) : Map<string, any> {
        return new Map<string, any>([["scheduledFor", run.runAt.toISOString()]]);
    }

    private key(appId : string, workflowId : string) : string {
        return JSON.stringify([appId, workflowId]);
    }

}

export { JobRunScheduler };
