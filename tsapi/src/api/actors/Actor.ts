type ActorType = "HUMAN" | "CODE" | "AGENT";

interface Actor {

    type : ActorType;
    id : string;
    role : string;

}

export type { Actor, ActorType }
