import {QueueMessage} from "../cloud/QueueMessage";

interface Queue {

    enqueue(jobId : string, workflowId : string) : Promise<void>;
    dequeueSome() : Promise<Array<QueueMessage>>;
    schedule(jobId : string, workflowId : string, due : Date) : Promise<void>;

}

export { Queue }
