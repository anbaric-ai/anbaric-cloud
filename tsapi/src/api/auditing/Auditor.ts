import {Actor} from "../actors/Actor";

type AuditChange = "CREATE" | "UPDATE_PROPERTIES" | "CHANGE_STATE" | "DELETE";

interface Auditor {

    audit(jobId : string, actor : Actor, change : AuditChange,
          changeDescription : string, details : any) : Promise<void>;

}

export type { AuditChange, Auditor }
