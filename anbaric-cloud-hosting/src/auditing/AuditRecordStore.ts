import {AuditRecord} from "anbaric-tsapi";

type AuditFilter = {
    appId? : string,
    resourceType? : string,
    resourceId? : string,
    actorId? : string,
    interaction? : string,
    search? : string,
    pageSize? : number,
    page? : number,
};

interface AuditRecordStore {

    save(record : AuditRecord) : Promise<void>;
    list(filter : AuditFilter) : Promise<Array<AuditRecord>>;

}

export type { AuditFilter, AuditRecordStore }
