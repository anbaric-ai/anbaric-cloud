import {beforeEach, describe, expect, it} from "vitest";
import {InMemoryAuditRecordStore} from "../../src/auditing/InMemoryAuditRecordStore";

describe("InMemoryAuditRecordStore", () => {

    let store : InMemoryAuditRecordStore;

    beforeEach(async () => {
        store = new InMemoryAuditRecordStore();
        await store.save({ jobId: "job-1", actorId: "chris", actorType: "HUMAN", description: "Properties updated", details: { age: 42 } });
        await store.save({ jobId: "job-2", actorId: "bot", actorType: "CODE", description: "Properties updated", details: null });
        await store.save({ jobId: "job-1", description: 'Transitioned to "done"', details: null });
    });

    it("lists newest first with generated ids and timestamps", async () => {
        const records = await store.list({});

        expect(records).toHaveLength(3);
        expect(records[0].description).toBe('Transitioned to "done"');
        expect(records[0].id).toBeTruthy();
        expect(records[0].at).toBeTruthy();
    });

    it("filters by job", async () => {
        expect((await store.list({ jobId: "job-1" }))).toHaveLength(2);
    });

    it("filters by actor", async () => {
        const records = await store.list({ actorId: "bot" });

        expect(records).toHaveLength(1);
        expect(records[0].jobId).toBe("job-2");
    });

    it("searches descriptions case-insensitively", async () => {
        expect(await store.list({ search: "transitioned" })).toHaveLength(1);
    });

    it("pages results", async () => {
        expect(await store.list({ pageSize: 2, page: 1 })).toHaveLength(1);
    });

});
