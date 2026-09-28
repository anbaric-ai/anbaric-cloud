import {Actor} from "../actors/Actor.js";
import {Job} from "../jobs/Job.js";

type CodePredicate = (job : Job) => boolean | Promise<boolean>;
type CodeRun = (job : Job) => Promise<Map<string, any>>;

/* A unit of work in a state. The predicate may be asynchronous, since reading
   a job's properties is. */
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

    predicate : CodePredicate = (_job : Job) => true;
    run : CodeRun = async (_job : Job) => new Map();

}

export { Action }
