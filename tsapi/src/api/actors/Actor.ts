type ActorType = "HUMAN" | "CODE" | "AGENT" | "SYSTEM";

interface Actor {

    type : ActorType;
    id : string;
    role : string;

}

export type { Actor, ActorType }
