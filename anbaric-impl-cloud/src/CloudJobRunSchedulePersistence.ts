import {JobRunSchedulePersistence, ScheduledRun} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient.js";

class CloudJobRunSchedulePersistence implements JobRunSchedulePersistence {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl()) {
        this.client = new CloudApiClient(baseUrl);
    }

    async highWaterMark(appId : string, workflowId : string) : Promise<Date | undefined> {
        const query = `appId=${encodeURIComponent(appId)}&workflowId=${encodeURIComponent(workflowId)}`;
        const response = await this.client.request("GET", `/job-run-schedules/high-water-mark?${query}`) as
            { highWaterMark : string | null };
        return response.highWaterMark ? new Date(response.highWaterMark) : undefined;
    }

    async plan(runs : Array<ScheduledRun>) : Promise<void> {
        if (runs.length === 0) return;
        await this.client.request("POST", "/job-run-schedules/plan", {
            runs: runs.map(run => ({ ...run, runAt: run.runAt.toISOString() })),
        });
    }

    async claimDue(at : Date) : Promise<Array<ScheduledRun>> {
        const response = await this.client.request("POST", "/job-run-schedules/claim-due",
            { at: at.toISOString() }) as { runs : Array<{ appId : string, workflowId : string, runAt : string }> };
        return (response.runs ?? []).map(run => ({
            appId: run.appId ?? "",
            workflowId: run.workflowId,
            runAt: new Date(run.runAt),
        }));
    }

}

export { CloudJobRunSchedulePersistence }
