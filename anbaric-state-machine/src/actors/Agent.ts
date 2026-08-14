import {Actor} from "anbaric-tsapi";

class Agent implements Actor {

    readonly type = "AGENT" as const;
    readonly id : string;
    readonly role : string;

    constructor(id : string, role : string) {
        this.id = id;
        this.role = role;
    }

}

export { Agent }
