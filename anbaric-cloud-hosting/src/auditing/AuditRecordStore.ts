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

    /* Removes records older than the moment given, at most `limit` of them,
       oldest first, and says how many went - so a backlog is cleared a batch
       at a time rather than in one statement that holds a lock and leaves
       every dead row behind at once. */
    deleteBefore(before : Date, limit : number) : Promise<number>;

}

export type { AuditFilter, AuditRecordStore }
