import {Job} from "../jobs/Job.js";
import {WaitForInput} from "../actions/WaitForInput.js";

/* Tells people a job is waiting on them. An Await names its targets; how they
   are reached - email, chat, something else - is the notifier's business, and
   the state machine neither knows nor cares. Targets are opaque strings: an
   implementation decides what they mean.

   Notifying is a side channel. A notifier that fails must not stop a job
   parking, so the state machine logs and carries on. */
interface Notifier {

    notify(targets : Array<string>, job : Job, waitingFor : WaitForInput) : Promise<void>;

}

export type { Notifier };
