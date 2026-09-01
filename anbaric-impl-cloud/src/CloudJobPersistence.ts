import {AppAware, Auditor, currentAppId, Job, JobPersistence, NoOpAuditor, SerializedJob, deserializeJob, serializeJob} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient";

class CloudJobPersistence extends JobPersistence implements AppAware {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl(), auditor : Auditor = new NoOpAuditor()) {
        super(auditor);
        this.client = new CloudApiClient(baseUrl);
    }

    getAppId() : string {
        return currentAppId();
    }

    protected async saveInternal(job : Job) : Promise<void> {
        await this.client.request("PUT", `/jobs/${encodeURIComponent(job.id)}`, serializeJob(job));
    }

    protected async retrieveInternal(id : string) : Promise<Job> {
        const serialized = await this.client.request("GET", `/jobs/${encodeURIComponent(id)}`) as SerializedJob;
        return deserializeJob(serialized);
    }

    protected async deleteInternal(id : string) : Promise<void> {
        await this.client.request("DELETE", `/jobs/${encodeURIComponent(id)}`);
    }

    protected async listInternal(pageSize : number = 100, page : number = 0) : Promise<Array<Job>> {
        const serialized = await this.client.request("GET", `/jobs?pageSize=${pageSize}&page=${page}`) as Array<SerializedJob>;
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
