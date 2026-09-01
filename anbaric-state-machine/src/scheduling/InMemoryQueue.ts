import {Dequeue, QueueMessage} from "anbaric-tsapi";

class InMemoryQueue implements Dequeue {

    private ready : Array<QueueMessage> = [];
    private scheduled : Array<{ message : QueueMessage, due : Date }> = [];

    async enqueue(jobId : string, appId : string | undefined, workflowId : string) : Promise<void> {
        this.ready.push({ jobId, appId, workflowId });
    }

    async schedule(jobId : string, appId : string | undefined, workflowId : string, due : Date) : Promise<void> {
        this.scheduled.push({ message: { jobId, appId, workflowId }, due });
    }

    async dequeueSome() : Promise<Array<QueueMessage>> {
        const now = new Date();
        const released = this.scheduled
            .filter((entry) => entry.due <= now)
            .sort((a, b) => a.due.getTime() - b.due.getTime());
        this.scheduled = this.scheduled.filter((entry) => entry.due > now);
        const messages = [...this.ready, ...released.map((entry) => entry.message)];
        this.ready = [];
        return messages;
    }

}

export { InMemoryQueue }
