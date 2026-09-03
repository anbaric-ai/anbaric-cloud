import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {CloudSessionResolver} from "anbaric-impl-cloud";
import {Role} from "../../src/auth/Role";
import {SessionSigner} from "../../src/auth/SessionSigner";
import {Tenant} from "../../src/auth/Tenant";
import {User} from "../../src/auth/User";
import {HostingServer} from "../../src/hosting/HostingServer";
import {RemoteQueue} from "../../src/queuing/RemoteQueue";

class ConfirmableInMemoryQueue extends InMemoryQueue implements RemoteQueue {

    async confirm(_message : QueueMessage) : Promise<void> {
    }

    async cancel(_message : QueueMessage) : Promise<void> {
    }

    async size() : Promise<number> {
        return 0;
    }

}

const SECRET = "sessions-round-trip-secret";

describe("session resolution through the internal endpoint", () => {

    let server : HostingServer;

    beforeEach(() => { process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET; });

    afterEach(async () => {
        delete process.env.ANBARIC_SESSION_SIGNING_SECRET;
        delete process.env.ANBARIC_CLOUD_URL;
        await server.close();
    });

    const bootAndResolver = async () : Promise<CloudSessionResolver> => {
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue());
        process.env.ANBARIC_CLOUD_URL = `http://127.0.0.1:${await server.listenInternal(0)}`;
        return new CloudSessionResolver();
    };

    it("resolves a minted session token to the user", async () => {
        const resolver = await bootAndResolver();
        const token = new SessionSigner(SECRET).mint(new User("ada", [new Role("admin"), new Role("reviewer")]), new Tenant("acme"));

        expect(await resolver.resolve(token)).toEqual({ id: "ada", roles: ["admin", "reviewer"], tenant: "acme" });
    });

    it("returns undefined for a tampered or unknown token", async () => {
        const resolver = await bootAndResolver();

        expect(await resolver.resolve("not.a.valid.token")).toBeUndefined();
    });

});
