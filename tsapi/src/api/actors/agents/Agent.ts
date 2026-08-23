import {Actor} from "../Actor";
import {AgentRequest} from "./AgentRequest";

/* An agent is a light actor: identity only, used for auditing and
   authorization like any other actor. The functional model detail lives in
   its Client collaborator, keeping the actor itself pure data. */
class Agent implements Actor {

    readonly type = "AGENT" as const;
    readonly id : string;
    readonly roles : Array<string>;
    readonly client : Agent.Client;

    constructor(id : string, roles : Array<string> | string, client : Agent.Client) {
        this.id = id;
        this.roles = typeof roles === "string" ? [roles] : roles;
        this.client = client;
    }

}

namespace Agent {

    export abstract class Client {

        abstract generate(request : AgentRequest) : Promise<Record<string, any>>;

    }

}

export { Agent }
