import {Actor, ActorType} from "./Actor";

class SystemActor implements Actor {

    type : ActorType = "SYSTEM";
    id = "_SYSTEM";
    role = "_SYSTEM";

    static actor = new SystemActor();

}

export { SystemActor }