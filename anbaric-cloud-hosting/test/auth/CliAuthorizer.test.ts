import {beforeEach, describe, expect, it} from "vitest";
import {CliAuthorizer} from "../../src/auth/CliAuthorizer";
import {InMemoryCliKeyStore} from "../../src/auth/InMemoryCliKeyStore";
import {User} from "../../src/auth/User";

describe("CliAuthorizer", () => {

    let keyStore : InMemoryCliKeyStore;
    let authorizer : CliAuthorizer;

    beforeEach(() => {
        keyStore = new InMemoryCliKeyStore();
        authorizer = new CliAuthorizer(keyStore);
    });

    it("issues a keypair and stores only the public half against the user", async () => {
        await authorizer.approve("request-1", "chris laptop", new User("auth0|user-1"));

        const keys = await keyStore.listFor("auth0|user-1");
        expect(keys).toHaveLength(1);
        expect(keys[0].clientName).toBe("chris laptop");
        expect(keys[0].publicKey).toContain("BEGIN PUBLIC KEY");
        expect(JSON.stringify(keys[0])).not.toContain("PRIVATE");
    });

    it("hands the full keypair to the requesting CLI exactly once", async () => {
        await authorizer.approve("request-1", "chris laptop", new User("auth0|user-1"));

        const issued = authorizer.collect("request-1");

        expect(issued?.clientName).toBe("chris laptop");
        expect(issued?.publicKey).toContain("BEGIN PUBLIC KEY");
        expect(issued?.privateKey).toContain("BEGIN PRIVATE KEY");
        expect(authorizer.collect("request-1")).toBeUndefined();
    });

    it("has nothing to collect for an unapproved request", () => {
        expect(authorizer.collect("never-approved")).toBeUndefined();
    });

    it("issues a distinct keypair per approval", async () => {
        await authorizer.approve("request-1", "laptop", new User("user-1"));
        await authorizer.approve("request-2", "desktop", new User("user-1"));

        const first = authorizer.collect("request-1");
        const second = authorizer.collect("request-2");

        expect(first?.privateKey).not.toBe(second?.privateKey);
        expect(first?.keyId).not.toBe(second?.keyId);
    });

    it("lists and revokes a user's keys", async () => {
        await authorizer.approve("request-1", "laptop", new User("user-1"));
        const [key] = await authorizer.keysFor("user-1");

        await authorizer.revoke(key.id, "user-1");

        expect(await authorizer.keysFor("user-1")).toEqual([]);
    });

});
