import {AuditInteraction, AuditRecord} from "anbaric-tsapi";

type AuditFilter = {
    resourceType? : string,
    resourceId? : string,
    actorId? : string,
    interaction? : AuditInteraction,
    search? : string,
    pageSize? : number,
    page? : number,
};

interface AuditRecordStore {

    save(record : AuditRecord) : Promise<void>;
    list(filter : AuditFilter) : Promise<Array<AuditRecord>>;

}

export type { AuditFilter, AuditRecordStore }
