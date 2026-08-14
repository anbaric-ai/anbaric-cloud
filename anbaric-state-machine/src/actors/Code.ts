import {Actor} from "anbaric-tsapi";

class Code implements Actor {

    readonly type = "CODE" as const;
    readonly id : string;
    readonly role : string;

    constructor(id : string, role : string = "code") {
        this.id = id;
        this.role = role;
    }

}

export { Code }
