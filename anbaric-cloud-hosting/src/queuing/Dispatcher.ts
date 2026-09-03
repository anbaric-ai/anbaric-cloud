import {QueueMessage} from "anbaric-tsapi";
import {RemoteQueue} from "./RemoteQueue";
import {ConsumerRegistry} from "./ConsumerRegistry";

class Dispatcher {

    private ticker? : NodeJS.Timeout;
    private draining = false;

    constructor(private queue : RemoteQueue, private registry : ConsumerRegistry,
                private dispatchIntervalMs : number = 1000) {}

    start() : void {
        if (this.ticker) return;
        this.ticker = setInterval(() => void this.drain(), this.dispatchIntervalMs);
        this.ticker.unref();
    }

    async cleanUp() : Promise<void> {
        if (this.ticker) clearInterval(this.ticker);
        this.ticker = undefined;
    }

    /* The queue leases each dequeued message and redelivers any it is not
       `confirm`ed — the consumer confirms once it has processed one. So the
       dispatcher never puts a message back: a failed push just leaves the
       message to redeliver on its next lease. A message with no registered
       listener yet is debounced (backed off), which lets a momentary
       registration race resolve and cancels the message only if it never
       finds a listener. */
    private async drain() : Promise<void> {
        if (this.draining) return;
        this.draining = true;
        try {
            const messages = await this.queue.dequeueSome();
            const byConsumerUrl = new Map<string, Array<QueueMessage>>();

            for (const message of messages) {
                const url = this.registry.lookup(message.appId, message.workflowId);
                if (!url) {
                    await this.queue.debounce(message);
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
            // Left in the queue: the unconfirmed lease redelivers it for retry.
        }
    }

}

export { Dispatcher }
