import {Queue} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient";

class CloudQueue implements Queue {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl()) {
        this.client = new CloudApiClient(baseUrl);
    }

    async enqueue(jobId : string, appId : string | undefined, workflowId : string) : Promise<void> {
        await this.client.request("POST", "/queue/enqueue", { jobId, appId, workflowId });
    }

    async schedule(jobId : string, appId : string | undefined, workflowId : string, due : Date) : Promise<void> {
        await this.client.request("POST", "/queue/schedule", { jobId, appId, workflowId, due: due.toISOString() });
    }

}

export { CloudQueue }
