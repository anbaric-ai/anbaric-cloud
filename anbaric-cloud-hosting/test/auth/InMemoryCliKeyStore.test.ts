import {beforeEach, describe, expect, it} from "vitest";
import {CliKey} from "../../src/auth/CliKey";
import {InMemoryCliKeyStore} from "../../src/auth/InMemoryCliKeyStore";

describe("InMemoryCliKeyStore", () => {

    let store : InMemoryCliKeyStore;

    beforeEach(() => {
        store = new InMemoryCliKeyStore();
    });

    it("lists a user's keys and only theirs", async () => {
        await store.save(new CliKey("key-1", "user-1", "laptop", "pem-1"));
        await store.save(new CliKey("key-2", "user-2", "desktop", "pem-2"));

        expect((await store.listFor("user-1")).map(key => key.id)).toEqual(["key-1"]);
    });

    it("finds a key by id regardless of owner", async () => {
        await store.save(new CliKey("key-1", "user-1", "laptop", "pem-1"));

        expect((await store.find("key-1"))?.userId).toBe("user-1");
        expect(await store.find("key-9")).toBeUndefined();
    });

    it("deletes a key only for its owner", async () => {
        await store.save(new CliKey("key-1", "user-1", "laptop", "pem-1"));

        await store.delete("key-1", "someone-else");
        expect(await store.listFor("user-1")).toHaveLength(1);

        await store.delete("key-1", "user-1");
        expect(await store.listFor("user-1")).toEqual([]);
    });

});
