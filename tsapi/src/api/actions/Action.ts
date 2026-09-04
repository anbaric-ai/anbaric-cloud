import {Actor} from "../actors/Actor.js";
import {Job} from "../jobs/Job.js";

type CodeRun = (job : Job) => Promise<Map<string, any>>;

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

    predicate = (_job : Job) => true;
    run : CodeRun = async (_job : Job) => new Map();

}

export { Action }
