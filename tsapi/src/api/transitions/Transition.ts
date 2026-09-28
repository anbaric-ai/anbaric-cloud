import {Job} from "../jobs/Job.js";
import {Reads} from "../jobs/Reads.js";

/* A move to another state, taken by the first transition whose predicate holds.
   The predicate is optional: a transition with no guard always fires, which is
   what you want when a state's actions simply run and the job moves on. Guard
   it only when the move is conditional. `reads` names the properties the
   predicate looks at, everything by default; an unguarded transition reads
   nothing. */
class Transition {

    to: string;
    predicate: (job: Job) => boolean;
    reads : Reads;

    constructor(to: string, predicate? : (job: Job) => boolean, reads? : Reads) {
        this.to = to;
        this.predicate = predicate ?? (() => true);
        this.reads = reads ?? (predicate ? Reads.everything : Reads.nothing);
    }

}

export { Transition }