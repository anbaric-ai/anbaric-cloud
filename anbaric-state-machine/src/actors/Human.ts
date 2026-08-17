import {Actor} from "anbaric-tsapi";

class Human implements Actor {

    readonly type = "HUMAN" as const;
    readonly id : string;
    readonly role : string;

    constructor(id : string, role : string) {
        this.id = id;
        this.role = role;
    }

    static createFromSession() {

    }

}

export { Human }
