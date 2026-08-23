import {beforeEach, describe, expect, it} from "vitest";
import {Actor, JsonSchema, NoOpAuditor} from "anbaric-tsapi";
import {InMemoryJsonStore} from "../src/InMemoryJsonStore";

const customerSchema : JsonSchema = {
    type: "object",
    required: ["name"],
    properties: { name: { type: "string" } },
};

const actor : Actor = { type: "CODE", id: "tester", roles: ["code"] };

describe("InMemoryJsonStore", () => {

    let store : InMemoryJsonStore;

    beforeEach(() => {
        store = new InMemoryJsonStore(new NoOpAuditor(), customerSchema);
    });

    it("round-trips a valid document", async () => {
        await store.create(actor, "doc-1", { name: "Ada" });

        expect(await store.retrieve("doc-1", actor)).toEqual({ name: "Ada" });
    });

    it("overwrites a document with the same id", async () => {
        await store.create(actor, "doc-1", { name: "Ada" });
        await store.save(actor, "updated", "doc-1", { name: "Grace" });

        expect(await store.retrieve("doc-1", actor)).toEqual({ name: "Grace" });
    });

    it("rejects a document that fails schema validation", async () => {
        await expect(store.create(actor, "doc-1", { name: 7 }))
            .rejects.toThrowError('Document "doc-1" failed schema validation: $.name should be string but was integer');
    });

    it("does not store a rejected document", async () => {
        await store.create(actor, "doc-1", { name: "Ada" }).catch(() => {});
        await store.save(actor, "updated", "doc-1", {}).catch(() => {});

        expect(await store.retrieve("doc-1", actor)).toEqual({ name: "Ada" });
    });

    it("accepts any document when no schema is given", async () => {
        const schemaless = new InMemoryJsonStore();

        await schemaless.create(actor, "doc-1", { anything: ["goes", 42] });

        expect(await schemaless.retrieve("doc-1", actor)).toEqual({ anything: ["goes", 42] });
    });

    it("rejects retrieval of an unknown id", async () => {
        await expect(store.retrieve("missing", actor)).rejects.toThrowError('No document found with id "missing"');
    });

    it("deletes a document and tolerates unknown ids", async () => {
        await store.create(actor, "doc-1", { name: "Ada" });

        await store.delete("doc-1", actor);
        await store.delete("missing", actor);

        await expect(store.retrieve("doc-1", actor)).rejects.toThrowError();
    });

    it("lists documents in insertion order with paging", async () => {
        for (const name of ["a", "b", "c", "d", "e"]) {
            await store.create(actor, name, { name });
        }

        expect((await store.list(actor)).map(document => document.name)).toEqual(["a", "b", "c", "d", "e"]);
        expect((await store.list(actor, 2, 1)).map(document => document.name)).toEqual(["c", "d"]);
        expect(await store.list(actor, 2, 5)).toEqual([]);
    });

});
