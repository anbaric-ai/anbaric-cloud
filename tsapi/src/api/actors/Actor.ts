type ActorType = "HUMAN" | "CODE" | "AGENT" | "SYSTEM";

interface Actor {

    type : ActorType;
    id : string;
    roles : Array<string>;

}

export type { Actor, ActorType }
