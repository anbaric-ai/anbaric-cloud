import {Dequeue, QueueMessage} from "anbaric-tsapi";
import {ConsumerRegistry} from "./ConsumerRegistry";

class Dispatcher {

    private ticker? : NodeJS.Timeout;
    private draining = false;

    /* A confirmable queue leases each dequeued message and redelivers any it is
       not `confirm`ed (the consumer confirms once it has processed it). So the
       dispatcher must NOT put unroutable or failed messages back — the leased
       row already redelivers, and re-enqueuing would add a fresh duplicate on
       every tick, growing the queue without bound. A plain queue removes on
       dequeue, so there those messages must be re-enqueued to be retried. */
    private readonly redelivers : boolean;

    constructor(private queue : Dequeue, private registry : ConsumerRegistry,
                private dispatchIntervalMs : number = 1000) {
        this.redelivers = typeof (this.queue as { confirm? : unknown }).confirm === "function";
    }

    start() : void {
        if (this.ticker) return;
        this.ticker = setInterval(() => void this.drain(), this.dispatchIntervalMs);
        this.ticker.unref();
    }

    async cleanUp() : Promise<void> {
        if (this.ticker) clearInterval(this.ticker);
        this.ticker = undefined;
    }

    private async drain() : Promise<void> {

        if (this.draining) return;
        this.draining = true;

        try {
            const messages = await this.queue.dequeueSome();
            const byConsumerUrl = new Map<string, Array<QueueMessage>>();

            for (const message of messages) {
                const url = this.registry.lookup(message.appId, message.workflowId);
                if (!url) {
                    if (!this.redelivers) await this.queue.enqueue(message.jobId, message.appId, message.workflowId);
                    continue;
                }
                byConsumerUrl.set(url, [...(byConsumerUrl.get(url) ?? []), message]);
            }

            for (const [url, batch] of byConsumerUrl) {
                await this.push(url, batch);
            }
        } finally {
            this.draining = false;
        }
    }

    private async push(url : string, batch : Array<QueueMessage>) : Promise<void> {
        try {
            const response = await fetch(`${url}/process`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ messages: batch }),
            });
            if (!response.ok) throw new Error(`Consumer at ${url} responded with status ${response.status}`);
        } catch {
            if (!this.redelivers) {
                for (const message of batch) {
                    await this.queue.enqueue(message.jobId, message.appId, message.workflowId);
                }
            }
        }
    }

}

export { Dispatcher }
