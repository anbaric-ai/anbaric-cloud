import {Actor} from "anbaric-tsapi";

class Code implements Actor {

    readonly type = "CODE" as const;
    readonly id : string;
    readonly roles : Array<string>;

    constructor(id : string, roles : Array<string> | string = "code") {
        this.id = id;
        this.roles = typeof roles === "string" ? [roles] : roles;
    }

}

export { Code }
