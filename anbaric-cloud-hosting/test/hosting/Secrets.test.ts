import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {InMemorySecretStore} from "anbaric-data-store";
import {QueueMessage} from "anbaric-tsapi";
import {InMemoryMembershipService} from "../../src/auth/InMemoryMembershipService";
import {SessionSigner} from "../../src/auth/SessionSigner";
import {Tenant} from "../../src/auth/Tenant";
import {User} from "../../src/auth/User";
import {HostingServer} from "../../src/hosting/HostingServer";
import {RemoteQueue} from "../../src/queuing/RemoteQueue";

class ConfirmableInMemoryQueue extends InMemoryQueue implements RemoteQueue {

    async confirm(_message : QueueMessage) : Promise<void> {}

    async debounce(_message : QueueMessage) : Promise<void> {}

    async cancel(_message : QueueMessage) : Promise<void> {}

    async size() : Promise<number> {
        return 0;
    }

}

const SECRET = "secrets-secret";

describe("managing an app's secrets from the console or the CLI", () => {

    let server : HostingServer;
    let baseUrl : string;
    let stores : Map<string, InMemorySecretStore>;

    beforeEach(async () => {
        process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET;
        const memberships = new InMemoryMembershipService();
        memberships.add("bob", "BUILDER");
        memberships.add("fox", "USER");
        stores = new Map();
        const storeFor = (appId : string) => {
            if (! stores.has(appId)) stores.set(appId, new InMemorySecretStore(undefined, undefined, {}));
            return stores.get(appId)!;
        };

        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined, undefined,
            undefined, storeFor, undefined, undefined, undefined, "acme", undefined, [], undefined, undefined,
            undefined, undefined, memberships);
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    });

    afterEach(async () => {
        delete process.env.ANBARIC_SESSION_SIGNING_SECRET;
        await server.close();
    });

    const as = (id : string, app : string = "crm") => ({
        cookie: `anbaric_session=${new SessionSigner(SECRET).mint(new User(id), new Tenant("acme"))}`,
        "x-anbaric-app": app,
        "content-type": "application/json",
    });

    const set = (who : string, name : string, value : string, app? : string) =>
        fetch(`${baseUrl}/api/v2/secrets/${name}`, { method: "PUT", headers: as(who, app), body: JSON.stringify({ value }) });

    it("lets a builder set, list and delete an app's secrets, scoped to that app", async () => {
        expect((await set("bob", "openai-key", "sk-1")).status).toBe(204);
        expect((await set("bob", "other", "x", "billing")).status).toBe(204);

        const listed = await (await fetch(`${baseUrl}/api/v2/secrets`, { headers: as("bob") })).json();
        expect(listed).toEqual(["openai-key"]);
        expect(await stores.get("crm")!.retrieve("openai-key", { type: "CODE", id: "t", roles: [] })).toBe("sk-1");

        expect((await fetch(`${baseUrl}/api/v2/secrets/openai-key`, { method: "DELETE", headers: as("bob") })).status).toBe(204);
        expect(await (await fetch(`${baseUrl}/api/v2/secrets`, { headers: as("bob") })).json()).toEqual([]);
    });

    // Once set, a value is the app's alone: nobody reads it back through the api.
    it("never hands a value back to a person", async () => {
        await set("bob", "openai-key", "sk-1");

        const response = await fetch(`${baseUrl}/api/v2/secrets/openai-key`, { headers: as("bob") });

        expect(response.status).toBe(403);
        expect((await response.json()).error).toContain("cannot be read back");
    });

    it("is not a user's to manage", async () => {
        expect((await set("fox", "openai-key", "sk-1")).status).toBe(403);
        expect((await fetch(`${baseUrl}/api/v2/secrets`, { headers: as("fox") })).status).toBe(403);
    });

});
