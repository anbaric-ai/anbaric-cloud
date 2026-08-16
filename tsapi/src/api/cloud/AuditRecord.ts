type AuditRecord = {
    id? : string,
    jobId : string,
    actorId? : string,
    actorType? : string,
    description : string,
    details : any,
    at? : string,
};

export type { AuditRecord }
