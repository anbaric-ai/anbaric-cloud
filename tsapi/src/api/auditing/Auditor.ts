import {Actor} from "../actors/Actor";

enum AuditInteraction {
    CREATE = "CREATE",
    UPDATE_PROPERTIES = "UPDATE_PROPERTIES",
    CHANGE_STATE = "CHANGE_STATE",
    DELETE = "DELETE",
    READ = "READ",
    LIST = "LIST",
}

interface Auditor {

    audit(resourceType : string, resourceId : string, actor : Actor, interaction : AuditInteraction[],
          description : string, details : any) : Promise<void>;

}

export { AuditInteraction, Auditor }
