import {Job} from "../jobs/Job.js";

class Transition {
    to: string;
    predicate: (job: Job) => boolean;

    constructor(to: string, predicate: (job: Job) => boolean) {
        this.to = to;
        this.predicate = predicate;
    }
}

export { Transition }