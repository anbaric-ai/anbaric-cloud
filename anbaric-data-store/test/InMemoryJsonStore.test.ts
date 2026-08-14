import {beforeEach, describe, expect, it} from "vitest";
import {JsonSchema} from "anbaric-tsapi";
import {InMemoryJsonStore} from "../src/InMemoryJsonStore";

const customerSchema : JsonSchema = {
    type: "object",
    required: ["name"],
    properties: { name: { type: "string" } },
};

describe("InMemoryJsonStore", () => {

    let store : InMemoryJsonStore;

    beforeEach(() => {
        store = new InMemoryJsonStore(customerSchema);
    });

    it("round-trips a valid document", async () => {
        await store.save("doc-1", { name: "Ada" });

        expect(await store.retrieve("doc-1")).toEqual({ name: "Ada" });
    });

    it("overwrites a document with the same id", async () => {
        await store.save("doc-1", { name: "Ada" });
        await store.save("doc-1", { name: "Grace" });

        expect(await store.retrieve("doc-1")).toEqual({ name: "Grace" });
    });

    it("rejects a document that fails schema validation", async () => {
        await expect(store.save("doc-1", { name: 7 }))
            .rejects.toThrowError('Document "doc-1" failed schema validation: $.name should be string but was integer');
    });

    it("does not store a rejected document", async () => {
        await store.save("doc-1", { name: "Ada" }).catch(() => {});
        await store.save("doc-1", {}).catch(() => {});

        expect(await store.retrieve("doc-1")).toEqual({ name: "Ada" });
    });

    it("accepts any document when no schema is given", async () => {
        const schemaless = new InMemoryJsonStore();

        await schemaless.save("doc-1", { anything: ["goes", 42] });

        expect(await schemaless.retrieve("doc-1")).toEqual({ anything: ["goes", 42] });
    });

    it("rejects retrieval of an unknown id", async () => {
        await expect(store.retrieve("missing")).rejects.toThrowError('No document found with id "missing"');
    });

    it("deletes a document and tolerates unknown ids", async () => {
        await store.save("doc-1", { name: "Ada" });

        await store.delete("doc-1");
        await store.delete("missing");

        await expect(store.retrieve("doc-1")).rejects.toThrowError();
    });

    it("lists documents in insertion order with paging", async () => {
        for (const name of ["a", "b", "c", "d", "e"]) {
            await store.save(name, { name });
        }

        expect((await store.list()).map(document => document.name)).toEqual(["a", "b", "c", "d", "e"]);
        expect((await store.list(2, 1)).map(document => document.name)).toEqual(["c", "d"]);
        expect(await store.list(2, 5)).toEqual([]);
    });

});
