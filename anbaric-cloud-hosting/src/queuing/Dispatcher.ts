import {QueueMessage} from "anbaric-tsapi";
import {RemoteQueue} from "./RemoteQueue";

/* Where a message's consumer can be reached, or nothing if it has none right
   now. The hosting server composes one from what it knows: an app's
   deployment first, the consumer registry for messages without an app. */
type ConsumerRoute = (appId : string | undefined, workflowId : string) => Promise<string | undefined>;

/* What to do with a message the app turned away: it has no state machine for
   it, so nothing will ever process the job. */
type RejectedMessage = (message : QueueMessage) => Promise<void>;

class Dispatcher {

    private ticker? : NodeJS.Timeout;
    private draining = false;

    constructor(private queue : RemoteQueue, private route : ConsumerRoute,
                private dispatchIntervalMs : number = 1000,
                private rejected : RejectedMessage = async () => {}) {}

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
       message to redeliver on its next lease. A message with nowhere to go
       yet is debounced (backed off), which lets a momentary gap resolve and
       cancels the message only if it never finds a route. */
    private async drain() : Promise<void> {
        if (this.draining) return;
        this.draining = true;
        try {
            const messages = await this.queue.dequeueSome();
            const byConsumerUrl = new Map<string, Array<QueueMessage>>();

            for (const message of messages) {
                const url = await this.route(message.appId, message.workflowId);
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
            await this.giveUp(batch, await this.rejectedIn(response));
        } catch {
            // Left in the queue: the unconfirmed lease redelivers it for retry.
        }
    }

    // An app on an older library answers with only what it accepted.
    private async rejectedIn(response : Response) : Promise<Set<string>> {
        try {
            const body = await response.json() as { rejected? : unknown };
            return new Set(Array.isArray(body.rejected) ? body.rejected.filter((id) : id is string => typeof id === "string") : []);
        } catch {
            return new Set();
        }
    }

    private async giveUp(batch : Array<QueueMessage>, rejectedIds : Set<string>) : Promise<void> {
        for (const message of batch.filter(message => rejectedIds.has(message.jobId))) {
            await this.rejected(message).catch(() => undefined);
        }
    }

}

export { Dispatcher }
export type { ConsumerRoute, RejectedMessage }
