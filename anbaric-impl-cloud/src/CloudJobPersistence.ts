import {AppAware, Auditor, currentAppId, Job, JobPersistence, NoOpAuditor, SerializedJob, deserializeJob, serializeJob} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient.js";

class CloudJobPersistence extends JobPersistence implements AppAware {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl(), auditor : Auditor = new NoOpAuditor()) {
        super(auditor);
        this.client = new CloudApiClient(baseUrl);
    }

    getAppId() : string {
        return currentAppId();
    }

    // The properties in the body are the ones to write: the platform upserts
    // them and leaves the rest of the job's properties as they are.
    protected async saveInternal(job : Job, properties? : Map<string, any>) : Promise<void> {
        const serialized = { ...serializeJob(job), properties: Object.fromEntries(properties ?? []) };
        await this.client.request("PUT", `/jobs/${encodeURIComponent(job.id)}`, serialized);
    }

    protected async retrieveInternal(id : string, keys? : Array<string>) : Promise<Job> {
        const query = keys ? `?keys=${encodeURIComponent(keys.join(","))}` : "";
        const serialized = await this.client.request("GET", `/jobs/${encodeURIComponent(id)}${query}`) as SerializedJob;
        return deserializeJob(serialized);
    }

    protected async deleteInternal(id : string) : Promise<void> {
        await this.client.request("DELETE", `/jobs/${encodeURIComponent(id)}`);
    }

    protected async listInternal(pageSize : number = 100, page : number = 0, query : JobPersistence.Query = {}) : Promise<Array<Job>> {
        const parameters = new URLSearchParams({ pageSize: String(pageSize), page: String(page) });
        for (const [name, value] of Object.entries(query)) {
            if (value !== undefined) parameters.set(name, String(value));
        }
        const serialized = await this.client.request("GET", `/jobs?${parameters}`) as Array<SerializedJob>;
        return serialized.map(deserializeJob);
    }

    protected async killInternal(id : string) : Promise<void> {
        await this.client.request("POST", `/jobs/${encodeURIComponent(id)}/kill`, {});
    }

    protected async killOlderThanInternal(lastUpdatedBefore : Date) : Promise<number> {
        const result = await this.client.request("POST", "/jobs/kill-old", { before: lastUpdatedBefore.toISOString() });
        return result.killed;
    }

    protected async countByStateInternal() : Promise<Array<JobPersistence.StateCount>> {
        const result = await this.client.request("GET", "/jobs/stats");
        return result.states;
    }

}

export { CloudJobPersistence }
