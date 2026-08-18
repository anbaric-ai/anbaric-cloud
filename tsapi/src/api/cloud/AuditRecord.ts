import {AuditInteraction} from "../auditing/Auditor";

type AuditRecord = {
    id? : string,
    resourceType : string,
    resourceId : string,
    actorId : string,
    actorType : string,
    interaction : AuditInteraction[],
    description : string,
    details : any,
    at? : string,
};

export type { AuditRecord }
