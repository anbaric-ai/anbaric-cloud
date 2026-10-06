import {beforeEach, describe, expect, it} from "vitest";
import {randomBytes} from "node:crypto";
import {Actor} from "anbaric-tsapi";
import {InMemorySecretStore, environmentNameFor} from "../src/InMemorySecretStore.js";

const actor : Actor = { type: "CODE", id: "tester", roles: ["code"] };

describe("InMemorySecretStore", () => {

    let store : InMemorySecretStore;

    beforeEach(() => {
        store = new InMemorySecretStore();
    });

    it("round-trips a secret", async () => {
        await store.create(actor, "api-key", "s3cr3t-value");

        expect(await store.retrieve("api-key", actor)).toBe("s3cr3t-value");
    });

    it("overwrites a secret with the same name", async () => {
        await store.create(actor, "api-key", "old");
        await store.save(actor, "updated", "api-key", "new");

        expect(await store.retrieve("api-key", actor)).toBe("new");
    });

    it("never holds the plaintext value in memory", async () => {
        await store.create(actor, "api-key", "very-recognisable-plaintext");

        const storedBuffers = Array.from((store as any).secrets.values())
            .flatMap((secret : any) => [secret.iv, secret.cipherText, secret.authTag]);

        for (const buffer of storedBuffers) {
            expect(buffer.includes("very-recognisable-plaintext")).toBe(false);
        }
    });

    it("cannot decrypt with a different key", async () => {
        const keyed = new InMemorySecretStore(randomBytes(32));
        await keyed.create(actor, "api-key", "s3cr3t-value");

        const differentKey = new InMemorySecretStore(randomBytes(32));
        (differentKey as any).secrets = (keyed as any).secrets;

        await expect(differentKey.retrieve("api-key", actor)).rejects.toThrowError();
    });

    it("rejects retrieval of an unknown secret", async () => {
        await expect(store.retrieve("missing", actor)).rejects.toThrowError('No secret found with name "missing"');
    });

    /* The local backstop: the same line that reads a key from the platform's
       store reads it from a shell variable on a laptop. */
    it("falls back to the environment, under the name upper-cased, for a secret never written", async () => {
        const fromEnvironment = new InMemorySecretStore(randomBytes(32), undefined, { OPENAI_KEY: "sk-from-env", STRIPE_SECRET: "sk-stripe" });

        expect(await fromEnvironment.retrieve("openai-key", actor)).toBe("sk-from-env");
        expect(await fromEnvironment.retrieve("stripe.secret", actor)).toBe("sk-stripe");
        expect(environmentNameFor("my app/token")).toBe("MY_APP_TOKEN");
    });

    it("prefers a secret that was written over the environment, and never lists the environment", async () => {
        const fromEnvironment = new InMemorySecretStore(randomBytes(32), undefined, { OPENAI_KEY: "sk-from-env" });
        await fromEnvironment.create(actor, "openai-key", "sk-written");

        expect(await fromEnvironment.retrieve("openai-key", actor)).toBe("sk-written");
        expect(await fromEnvironment.list(actor)).toEqual(["openai-key"]);
        expect(await new InMemorySecretStore(randomBytes(32), undefined, { OPENAI_KEY: "x" }).list(actor)).toEqual([]);
    });

    it("deletes secrets and tolerates unknown names", async () => {
        await store.create(actor, "api-key", "s3cr3t-value");

        await store.delete("api-key", actor);
        await store.delete("missing", actor);

        await expect(store.retrieve("api-key", actor)).rejects.toThrowError();
    });

    it("lists secret names without values", async () => {
        await store.create(actor, "api-key", "a");
        await store.create(actor, "db-password", "b");

        expect(await store.list(actor)).toEqual(["api-key", "db-password"]);
    });

});
