import {Queue} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient";

class CloudQueue implements Queue {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl()) {
        this.client = new CloudApiClient(baseUrl);
    }

    async enqueue(jobId : string) : Promise<void> {
        await this.client.request("POST", "/queue/enqueue", { jobId });
    }

    async schedule(jobId : string, due : Date) : Promise<void> {
        await this.client.request("POST", "/queue/schedule", { jobId, due: due.toISOString() });
    }

    async dequeueSome() : Promise<Array<string>> {
        const result = await this.client.request("POST", "/queue/dequeue") as { jobIds : Array<string> };
        return result.jobIds;
    }

}

export { CloudQueue }
