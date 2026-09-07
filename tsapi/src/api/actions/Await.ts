import {Job} from "../jobs/Job.js";
import {AwaitParty, WaitForInput} from "./WaitForInput.js";

/* A pause point in a state's action list. When a job reaches an Await it runs
   nothing: the job is parked in the "Awaiting input" status and is not
   re-enqueued until an update to its properties arrives (a human filling in a
   form, say). An Await carries no actor - which actor eventually provides the
   input is not known until it does. It describes what is being waited on
   through the WaitForInput it assembles: the fields expected, a resolve URL
   (static, or derived per job) and any extra metadata. That WaitForInput is
   stored against the job and audited, and cleared once a transition moves the
   job on to another state.

   `notify` names who should be told the job is waiting. It is by convention
   rather than enforcement: the state machine hands the targets to whatever
   Notifier it was given, and what a target means is that notifier's business. */
class Await {

    readonly id : string;
    name : string;
    description : string;
    waitingFor? : AwaitParty;
    fields : Array<string> = [];
    resolveUrl : string | ((job : Job) => string) = "";
    metadata : (job : Job) => Map<string, any> = (_job : Job) => new Map();
    notify : Array<string> = [];

    constructor(name : string, waitingFor? : AwaitParty, description : string = "",
                id : string = crypto.randomUUID(), notify : Array<string> = []) {
        this.name = name;
        this.waitingFor = waitingFor;
        this.description = description;
        this.id = id;
        this.notify = notify;
    }

    waitForInput(job : Job) : WaitForInput {
        const resolveUrl = typeof this.resolveUrl === "function" ? this.resolveUrl(job) : this.resolveUrl;
        return new WaitForInput(this.fields, resolveUrl, this.metadata(job), this.waitingFor);
    }

}

export { Await }
