import {beforeEach, describe, expect, it} from "vitest";
import {randomBytes} from "node:crypto";
import {InMemorySecretStore} from "../src/InMemorySecretStore";

describe("InMemorySecretStore", () => {

    let store : InMemorySecretStore;

    beforeEach(() => {
        store = new InMemorySecretStore();
    });

    it("round-trips a secret", async () => {
        await store.save("api-key", "s3cr3t-value");

        expect(await store.retrieve("api-key")).toBe("s3cr3t-value");
    });

    it("overwrites a secret with the same name", async () => {
        await store.save("api-key", "old");
        await store.save("api-key", "new");

        expect(await store.retrieve("api-key")).toBe("new");
    });

    it("never holds the plaintext value in memory", async () => {
        await store.save("api-key", "very-recognisable-plaintext");

        const storedBuffers = Array.from((store as any).secrets.values())
            .flatMap((secret : any) => [secret.iv, secret.cipherText, secret.authTag]);

        for (const buffer of storedBuffers) {
            expect(buffer.includes("very-recognisable-plaintext")).toBe(false);
        }
    });

    it("cannot decrypt with a different key", async () => {
        const keyed = new InMemorySecretStore(randomBytes(32));
        await keyed.save("api-key", "s3cr3t-value");

        const differentKey = new InMemorySecretStore(randomBytes(32));
        (differentKey as any).secrets = (keyed as any).secrets;

        await expect(differentKey.retrieve("api-key")).rejects.toThrowError();
    });

    it("rejects retrieval of an unknown secret", async () => {
        await expect(store.retrieve("missing")).rejects.toThrowError('No secret found with name "missing"');
    });

    it("deletes secrets and tolerates unknown names", async () => {
        await store.save("api-key", "s3cr3t-value");

        await store.delete("api-key");
        await store.delete("missing");

        await expect(store.retrieve("api-key")).rejects.toThrowError();
    });

    it("lists secret names without values", async () => {
        await store.save("api-key", "a");
        await store.save("db-password", "b");

        expect(await store.list()).toEqual(["api-key", "db-password"]);
    });

});
