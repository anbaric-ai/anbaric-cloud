import {Actor} from "../actors/Actor.js";
import {Job} from "../jobs/Job.js";
import {Reads} from "../jobs/Reads.js";

type CodeRun = (job : Job) => Promise<Map<string, any>>;

/* A unit of work in a state. `reads` names the properties the action needs -
   given the machine's definitions, so it can be "everything" (the default),
   a fixed few, or whatever matches - and only those are loaded for the job
   before `predicate` and `run` see it. Declare it on any action that reads a
   little of a job that holds a lot. */
class Action {

    readonly id : string;
    name : string;
    description : string;
    actor : Actor;

    constructor(name : string, actor : Actor, description : string = "", id : string = crypto.randomUUID()) {
        this.name = name;
        this.actor = actor;
        this.description = description;
        this.id = id;
    }

    reads : Reads = Reads.everything;
    predicate = (_job : Job) => true;
    run : CodeRun = async (_job : Job) => new Map();

}

export { Action }
