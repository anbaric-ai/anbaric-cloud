import {AuditRecordStore} from "./AuditRecordStore";

const SWEEP_INTERVAL_MS = 24 * 60 * 60_000;
const BATCH_SIZE = 5_000;
const BATCHES_PER_SWEEP = 200;

/* How long audit records are kept unless the platform is told otherwise. A
   year: long enough that nobody is surprised by what has gone, short enough
   that the table does not grow for ever. Zero means keep everything. */
const DEFAULT_RETENTION_DAYS = 365;

const DAY_MS = 24 * 60 * 60_000;

/* Removes audit records older than the retention, once a day and once at
   start - a platform that restarts on every release would otherwise never
   reach its first daily tick. Deletion is done a batch at a time rather than
   in one statement, so clearing a backlog neither holds a lock for long nor
   leaves more dead rows at once than autovacuum can keep up with, and each
   sweep stops after a bounded number of batches so a very large backlog is
   worked through over several days rather than in one sitting. */
class AuditSweep {

    private ticker? : NodeJS.Timeout;
    private sweeping = false;

    constructor(private records : AuditRecordStore,
                private retentionDays : number = DEFAULT_RETENTION_DAYS,
                private intervalMs : number = SWEEP_INTERVAL_MS,
                private batchSize : number = BATCH_SIZE) {}

    start() : void {
        if (this.ticker || this.retentionDays <= 0) return;
        void this.sweep();
        this.ticker = setInterval(() => void this.sweep(), this.intervalMs);
        this.ticker.unref();
    }

    async sweep() : Promise<number> {
        if (this.sweeping || this.retentionDays <= 0) return 0;
        this.sweeping = true;

        const before = new Date(Date.now() - this.retentionDays * DAY_MS);
        let removed = 0;
        try {
            for (let batch = 0; batch < BATCHES_PER_SWEEP; batch++) {
                const went = await this.records.deleteBefore(before, this.batchSize);
                removed += went;
                if (went < this.batchSize) break;
            }
            if (removed > 0) console.log(`[audit] removed ${removed} record(s) older than ${this.retentionDays} days`);
            return removed;
        } catch (error) {
            console.error(`[audit] the retention sweep failed: ${error instanceof Error ? error.message : error}`);
            return removed;
        } finally {
            this.sweeping = false;
        }
    }

    async cleanUp() : Promise<void> {
        if (this.ticker) clearInterval(this.ticker);
        this.ticker = undefined;
    }

}

export { AuditSweep, DEFAULT_RETENTION_DAYS };
