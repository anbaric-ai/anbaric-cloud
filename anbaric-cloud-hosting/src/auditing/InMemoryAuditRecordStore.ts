import {AuditRecord} from "anbaric-tsapi";
import {randomUUID} from "node:crypto";
import {AuditFilter, AuditRecordStore} from "./AuditRecordStore";

class InMemoryAuditRecordStore implements AuditRecordStore {

    private records = new Array<AuditRecord>();

    async save(record : AuditRecord) : Promise<void> {
        this.records.push({ ...record, id: randomUUID(), at: record.at ?? new Date().toISOString() });
    }

    async list(filter : AuditFilter) : Promise<Array<AuditRecord>> {
        const pageSize = filter.pageSize ?? 100;
        const page = filter.page ?? 0;

        return this.records
            .filter(record => !filter.jobId || record.jobId === filter.jobId)
            .filter(record => !filter.actorId || record.actorId === filter.actorId)
            .filter(record => !filter.change || record.change === filter.change)
            .filter(record => !filter.search ||
                record.description.toLowerCase().includes(filter.search.toLowerCase()))
            .reverse()
            .slice(page * pageSize, (page + 1) * pageSize);
    }

}

export { InMemoryAuditRecordStore }
