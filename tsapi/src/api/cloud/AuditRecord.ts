import {AuditChange} from "../auditing/Auditor";

type AuditRecord = {
    id? : string,
    jobId : string,
    actorId : string,
    actorType : string,
    change : AuditChange,
    description : string,
    details : any,
    at? : string,
};

export type { AuditRecord }
