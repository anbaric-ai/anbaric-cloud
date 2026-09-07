import {Job} from "../jobs/Job.js";

/* A move to another state, taken by the first transition whose predicate holds.
   The predicate is optional: a transition with no guard always fires, which is
   what you want when a state's actions simply run and the job moves on. Guard
   it only when the move is conditional. */
class Transition {

    to: string;
    predicate: (job: Job) => boolean;

    constructor(to: string, predicate: (job: Job) => boolean = () => true) {
        this.to = to;
        this.predicate = predicate;
    }

}

export { Transition }