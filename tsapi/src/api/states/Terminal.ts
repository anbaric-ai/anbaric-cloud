import {State} from "./State.js";

/* An end state: a job that reaches a Terminal stops progressing and is never
   re-enqueued. The outcome records whether the workflow succeeded or failed. */
class Terminal extends State {

    readonly outcome : Terminal.Outcome;

    constructor(id : string, outcome : Terminal.Outcome) {
        super(id, [], [], true);
        this.outcome = outcome;
    }

}

namespace Terminal {

    export enum Outcome {
        SUCCESS = "SUCCESS",
        FAILURE = "FAILURE",
    }

}

export { Terminal }
