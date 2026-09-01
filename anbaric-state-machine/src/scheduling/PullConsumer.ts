import {Consumer, Dequeue, QueueMessage} from "anbaric-tsapi";

type ProcessJob = (jobId : string) => Promise<void>;

class PullConsumer implements Consumer {

    private subscribers = new Map<string, ProcessJob>();
    private ticker? : NodeJS.Timeout;
    private draining = false;

    constructor(private queue : Dequeue, private pollIntervalMs : number = 1000) {}

    // Subscribers are keyed by the (appId, workflowId) composite, encoded as a
    // tuple so an app and a machine id can never collide.
    private key(appId : string | undefined, workflowId : string) : string {
        return JSON.stringify([appId || null, workflowId]);
    }

    subscribe(appId : string | undefined, workflowId : string, processJob : ProcessJob) : void {
        this.subscribers.set(this.key(appId, workflowId), processJob);
        if (!this.ticker) {
            this.ticker = setInterval(() => void this.drain(), this.pollIntervalMs);
            this.ticker.unref();
        }
    }

    async cleanUp() : Promise<void> {
        if (this.ticker) clearInterval(this.ticker);
        this.ticker = undefined;
        this.subscribers.clear();
    }

    private async drain() : Promise<void> {
        if (this.draining) return;
        this.draining = true;
        try {
            for (const message of await this.queue.dequeueSome()) {
                await this.forward(message);
            }
        } finally {
            this.draining = false;
        }
    }

    private async forward(message : QueueMessage) : Promise<void> {
        const processJob = this.subscribers.get(this.key(message.appId, message.workflowId));
        if (!processJob) {
            await this.queue.enqueue(message.jobId, message.appId, message.workflowId);
            return;
        }
        try {
            await processJob(message.jobId);
        } catch {
            await this.queue.enqueue(message.jobId, message.appId, message.workflowId);
        }
    }

}

export { PullConsumer }
