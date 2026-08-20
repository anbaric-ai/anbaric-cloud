import {Actor} from "../actors/Actor";

/* Records an interaction with a resource. The interaction is one or more plain
   strings chosen by the persistence class that calls it - the auditor itself
   defines no vocabulary. */
interface Auditor {

    audit(resourceType : string, resourceId : string, actor : Actor, interaction : Array<string>,
          description : string, details : any) : Promise<void>;

}

export { Auditor }
