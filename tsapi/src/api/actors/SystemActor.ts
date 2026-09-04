import {Actor, ActorType} from "./Actor.js";

class SystemActor implements Actor {

    type : ActorType = "SYSTEM";
    id = "_SYSTEM";
    roles = ["_SYSTEM"];

    static actor = new SystemActor();

}

export { SystemActor }