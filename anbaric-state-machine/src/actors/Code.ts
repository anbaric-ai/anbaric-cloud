import {Actor, Job} from "anbaric-tsapi";

class Code implements Actor {

    readonly type = "CODE" as const;
    readonly id : string;
    readonly role : string;

    run : (job : Job) => Promise<Map<string, any>>;

    constructor(id : string, run : (job : Job) => Promise<Map<string, any>>, role : string = "code") {
        this.id = id;
        this.run = run;
        this.role = role;
    }

}

export { Code }
