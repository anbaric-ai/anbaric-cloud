import {Job, JobPersistence, SerializedJob, deserializeJob, serializeJob} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient";

class CloudJobPersistence implements JobPersistence {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl()) {
        this.client = new CloudApiClient(baseUrl);
    }

    async save(job : Job) : Promise<void> {
        await this.client.request("PUT", `/jobs/${encodeURIComponent(job.id)}`, serializeJob(job));
    }

    async retrieve(id : string) : Promise<Job> {
        const serialized = await this.client.request("GET", `/jobs/${encodeURIComponent(id)}`) as SerializedJob;
        return deserializeJob(serialized);
    }

    async delete(id : string) : Promise<void> {
        await this.client.request("DELETE", `/jobs/${encodeURIComponent(id)}`);
    }

    async list(pageSize : number = 100, page : number = 0) : Promise<Array<Job>> {
        const serialized = await this.client.request("GET", `/jobs?pageSize=${pageSize}&page=${page}`) as Array<SerializedJob>;
        return serialized.map(deserializeJob);
    }

    async updateProperties(id : string, properties : Map<string, any>) : Promise<void> {
        await this.client.request("PATCH", `/jobs/${encodeURIComponent(id)}/properties`, Object.fromEntries(properties));
    }

}

export { CloudJobPersistence }
