type AuditRecord = {
    id? : string,
    resourceType : string,
    resourceId : string,
    actorId : string,
    actorType : string,
    interaction : Array<string>,
    description : string,
    details : any,
    at? : string,
};

export type { AuditRecord }
