import {Actor} from "../actors/Actor";
import {Job} from "../jobs/Job";

type CodeRun = (job : Job) => Promise<Map<string, any>>;

class Action {

    readonly id : string;
    name : string;
    description : string;
    actor : Actor;

    predicate = (_job : Job) => true;

    constructor(name : string, actor : Actor, description : string = "", id : string = crypto.randomUUID()) {
        this.name = name;
        this.actor = actor;
        this.description = description;
        this.id = id;
    }

    async run(job : Job) : Promise<Map<string, any>> {
        if (this.actor.type === "CODE" && "run" in this.actor) {
            return (this.actor as Actor & { run : CodeRun }).run(job);
        }
        throw new Error(`Actions for "${this.actor.type}" actors are not implemented yet`);
    }

}

export { Action }
