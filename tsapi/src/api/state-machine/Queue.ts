import {Job} from "../jobs/Job";

interface Queue {

    enqueue(jobId : string) : void;
    dequeueSome() : Array<string>;
    schedule(jobId : string, due : Date) : void;

}

export { Queue }