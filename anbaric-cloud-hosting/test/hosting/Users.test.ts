import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {InMemoryUserDirectory} from "../../src/auth/InMemoryUserDirectory";
import {SessionSigner} from "../../src/auth/SessionSigner";
import {Tenant} from "../../src/auth/Tenant";
import {User} from "../../src/auth/User";
import {HostingServer} from "../../src/hosting/HostingServer";
import {RemoteQueue} from "../../src/queuing/RemoteQueue";

class ConfirmableInMemoryQueue extends InMemoryQueue implements RemoteQueue {

    async confirm(_message : QueueMessage) : Promise<void> {
    }

    async debounce(_message : QueueMessage) : Promise<void> {
    }

    async cancel(_message : QueueMessage) : Promise<void> {
    }

    async size() : Promise<number> {
        return 0;
    }

}

const SECRET = "users-round-trip-secret";

describe("the tenant user directory through the public entry point", () => {

    let server : HostingServer;
    let baseUrl : string;

    beforeEach(async () => {
        process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET;
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined, undefined,
            undefined, undefined, undefined, undefined, undefined, undefined, undefined, [], undefined, undefined,
            undefined, new InMemoryUserDirectory());
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    });

    afterEach(async () => {
        delete process.env.ANBARIC_SESSION_SIGNING_SECRET;
        await server.close();
    });

    const cookieFor = (user : User) => `anbaric_session=${new SessionSigner(SECRET).mint(user, new Tenant("acme"))}`;

    it("lists everyone who has presented a session, with their profile", async () => {
        const ada = new User("ada", [], [], "Ada Lovelace", "https://pic/ada", "ada@example.com");
        const grace = new User("grace", [], [], "Grace Hopper", undefined, "grace@example.com");
        await fetch(`${baseUrl}/api/v2/whoami`, { headers: { cookie: cookieFor(grace) } });

        const response = await fetch(`${baseUrl}/api/v2/users`, { headers: { cookie: cookieFor(ada) } });
        const users = await response.json();

        expect(response.status).toBe(200);
        expect(users.map((user : any) => [user.id, user.name, user.email])).toEqual([
            ["ada", "Ada Lovelace", "ada@example.com"],
            ["grace", "Grace Hopper", "grace@example.com"],
        ]);
        expect(users[0].lastSeenAt).toMatch(/^\d{4}-/);
    });

    it("is empty before anyone has signed in", async () => {
        const users = await (await fetch(`${baseUrl}/api/v2/users`)).json();

        expect(users).toEqual([]);
    });

});
