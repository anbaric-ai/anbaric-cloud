import {beforeEach, describe, expect, it} from "vitest";
import {InMemoryAuditRecordStore} from "../../src/auditing/InMemoryAuditRecordStore";

describe("InMemoryAuditRecordStore", () => {

    let store : InMemoryAuditRecordStore;

    beforeEach(async () => {
        store = new InMemoryAuditRecordStore();
        await store.save({ resourceType: "job", resourceId: "job-1", actorId: "chris", actorType: "HUMAN", interaction: ["UPDATE_PROPERTIES"], description: "Properties updated", details: { age: 42 } });
        await store.save({ resourceType: "job", resourceId: "job-2", actorId: "bot", actorType: "CODE", interaction: ["UPDATE_PROPERTIES"], description: "Properties updated", details: null });
        await store.save({ resourceType: "job", resourceId: "job-1", actorId: "workflow-1", actorType: "CODE", interaction: ["CHANGE_STATE"], description: 'Transitioned to "done"', details: null });
    });

    it("lists newest first with generated ids and timestamps", async () => {
        const records = await store.list({});

        expect(records).toHaveLength(3);
        expect(records[0].description).toBe('Transitioned to "done"');
        expect(records[0].id).toBeTruthy();
        expect(records[0].at).toBeTruthy();
    });

    it("filters by resource", async () => {
        expect((await store.list({ resourceType: "job", resourceId: "job-1" }))).toHaveLength(2);
    });

    it("filters by actor", async () => {
        const records = await store.list({ actorId: "bot" });

        expect(records).toHaveLength(1);
        expect(records[0].resourceId).toBe("job-2");
    });

    it("filters by interaction", async () => {
        const records = await store.list({ interaction: "CHANGE_STATE" });

        expect(records).toHaveLength(1);
        expect(records[0].description).toBe('Transitioned to "done"');
    });

    it("searches descriptions case-insensitively", async () => {
        expect(await store.list({ search: "transitioned" })).toHaveLength(1);
    });

    it("pages results", async () => {
        expect(await store.list({ pageSize: 2, page: 1 })).toHaveLength(1);
    });

});
