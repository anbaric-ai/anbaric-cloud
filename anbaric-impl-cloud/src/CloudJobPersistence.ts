import {Auditor, Job, JobPersistence, NoOpAuditor, SerializedJob, deserializeJob, serializeJob} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient";

class CloudJobPersistence extends JobPersistence {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl(), auditor : Auditor = new NoOpAuditor()) {
        super(auditor);
        this.client = new CloudApiClient(baseUrl);
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

}

export { CloudJobPersistence }
