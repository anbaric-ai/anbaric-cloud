import {Queue, QueueMessage} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient";

class CloudQueue implements Queue {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl()) {
        this.client = new CloudApiClient(baseUrl);
    }

    async enqueue(jobId : string, workflowId : string) : Promise<void> {
        await this.client.request("POST", "/queue/enqueue", { jobId, workflowId });
    }

    async schedule(jobId : string, workflowId : string, due : Date) : Promise<void> {
        await this.client.request("POST", "/queue/schedule", { jobId, workflowId, due: due.toISOString() });
    }

    async dequeueSome() : Promise<Array<QueueMessage>> {
        const result = await this.client.request("POST", "/queue/dequeue") as { messages : Array<QueueMessage> };
        return result.messages;
    }

}

export { CloudQueue }
