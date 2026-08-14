import {QueueMessage} from "../cloud/QueueMessage";

interface Queue {

    enqueue(jobId : string, workflowId : string) : Promise<void>;
    schedule(jobId : string, workflowId : string, due : Date) : Promise<void>;

}

interface Dequeue extends Queue {

    dequeueSome() : Promise<Array<QueueMessage>>;

}

const Dequeue = {
    supports(queue : Queue) : queue is Dequeue {
        return "dequeueSome" in queue;
    },
};

export { Queue, Dequeue }
