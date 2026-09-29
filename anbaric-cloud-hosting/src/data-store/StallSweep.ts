import {PostgresJobPersistence} from "./PostgresJobPersistence";

const SWEEP_INTERVAL_MS = 60_000;

/* Marks a job Stalled when the long-running step that was heartbeating it has
   gone quiet - the process running it died, most likely mid-deploy or on a
   crash. Marking is all it does: the platform never re-runs a long step on its
   own, because only the app knows what a half-finished one has already done.
   Someone sees the status and decides. */
class StallSweep {

    private ticker? : NodeJS.Timeout;
    private sweeping = false;

    constructor(private persistence : PostgresJobPersistence,
                private intervalMs : number = SWEEP_INTERVAL_MS) {}

    start() : void {
        if (this.ticker) return;
        this.ticker = setInterval(() => void this.sweep(), this.intervalMs);
        this.ticker.unref();
    }

    async sweep() : Promise<number> {
        if (this.sweeping) return 0;
        this.sweeping = true;
        try {
            const stalled = await this.persistence.markStalled();
            if (stalled > 0) console.warn(`[jobs] marked ${stalled} job(s) stalled: no heartbeat from a long-running step`);
            return stalled;
        } catch (error) {
            console.error(`[jobs] the stall sweep failed: ${error instanceof Error ? error.message : error}`);
            return 0;
        } finally {
            this.sweeping = false;
        }
    }

    async cleanUp() : Promise<void> {
        if (this.ticker) clearInterval(this.ticker);
        this.ticker = undefined;
    }

}

export { StallSweep }
