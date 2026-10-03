type FetchFn = (url : string, init : RequestInit) => Promise<Response>;

// How many apps are running, and how many of those are on a large instance.
type CountApps = () => { apps : number, large : number };

const REPORT_INTERVAL_MS = 60 * 60_000;

/* Tells the control plane how many apps this tenant is running, hourly.
   Hourly rather than daily because a day is recorded as the most apps seen on
   it: an app deployed at noon has still run that day, and a platform that only
   spoke at midnight would never have seen it.

   It reports a number and learns nothing back. What an app costs, what the
   tenant's allowance covers and when it is billed are the control plane's
   business - so pricing can change without redeploying a single customer's
   platform. A report that fails is simply the next hour's problem: the day is
   the highest count that reached central, so one lost hour costs nothing
   unless every hour of the day is lost. */
class UsageReporter {

    private ticker? : NodeJS.Timeout;

    constructor(private centralUrl : string, private secret : string, private tenantSlug : string,
                private countApps : CountApps,
                private fetchFn : FetchFn = (url, init) => fetch(url, init),
                private intervalMs : number = REPORT_INTERVAL_MS) {}

    start() : void {
        if (this.ticker) return;
        void this.report();
        this.ticker = setInterval(() => void this.report(), this.intervalMs);
        this.ticker.unref?.();
    }

    async report() : Promise<boolean> {
        try {
            const response = await this.fetchFn(`${this.centralUrl}/usage`, {
                method: "POST",
                headers: { "content-type": "application/json", "x-anbaric-central-key": this.secret },
                body: JSON.stringify({ slug: this.tenantSlug, ...this.counted(), day: this.today() }),
            });
            if (! response.ok) console.warn(`[usage] central answered ${response.status} to the app count`);
            return response.ok;
        } catch (error) {
            console.warn(`[usage] could not report the app count: ${error instanceof Error ? error.message : error}`);
            return false;
        }
    }

    private counted() : { apps : number, largeApps : number } {
        const { apps, large } = this.countApps();
        return { apps, largeApps: large };
    }

    // The day in UTC, so every tenant's day starts at the same moment however
    // the platform's clock is set.
    private today() : string {
        return new Date().toISOString().slice(0, 10);
    }

    async cleanUp() : Promise<void> {
        if (this.ticker) clearInterval(this.ticker);
        this.ticker = undefined;
    }

}

export { UsageReporter };
export type { CountApps };
