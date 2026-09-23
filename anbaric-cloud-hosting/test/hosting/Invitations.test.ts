import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {InMemoryMembershipService} from "../../src/auth/InMemoryMembershipService";
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

const SECRET = "invitations-round-trip-secret";

describe("invitations through the console entry point", () => {

    let server : HostingServer;
    let baseUrl : string;
    let memberships : InMemoryMembershipService;

    beforeEach(async () => {
        process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET;
        memberships = new InMemoryMembershipService("https://central.example/invitations");
        memberships.add("ada", "OWNER");
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined, undefined,
            undefined, undefined, undefined, undefined, undefined, undefined, undefined, [], undefined, undefined,
            undefined, undefined, memberships);
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    });

    afterEach(async () => {
        delete process.env.ANBARIC_SESSION_SIGNING_SECRET;
        await server.close();
    });

    const cookie = () => `anbaric_session=${new SessionSigner(SECRET).mint(new User("ada", [], [], "Ada Lovelace"), new Tenant("acme"))}`;

    const invite = (email : string) => fetch(`${baseUrl}/api/v2/invitations`, {
        method: "POST", headers: { "content-type": "application/json", cookie: cookie() }, body: JSON.stringify({ email }),
    });

    it("invites by email, attributed to the signed-in user, and returns the link", async () => {
        const response = await invite("fox@example.com");
        const invitation = await response.json();

        expect(response.status).toBe(201);
        expect(invitation).toMatchObject({ email: "fox@example.com", invitedBy: "ada", invitedByName: "Ada Lovelace" });
        expect(invitation.link).toBe(`https://central.example/invitations/${invitation.token}`);
    });

    it("refuses to manage members for a role that cannot invite", async () => {
        memberships.add("bob", "BUILDER");
        const asBuilder = `anbaric_session=${new SessionSigner(SECRET).mint(new User("bob", [], [], "Bob"), new Tenant("acme"))}`;

        const listed = await fetch(`${baseUrl}/api/v2/invitations`, { headers: { cookie: asBuilder } });
        const invited = await fetch(`${baseUrl}/api/v2/invitations`, {
            method: "POST", headers: { "content-type": "application/json", cookie: asBuilder },
            body: JSON.stringify({ email: "fox@example.com" }),
        });

        expect(listed.status).toBe(403);
        expect(invited.status).toBe(403);
    });

    it("refuses a session belonging to no member of this tenant at all", async () => {
        const stranger = `anbaric_session=${new SessionSigner(SECRET).mint(new User("nobody"), new Tenant("acme"))}`;

        const response = await fetch(`${baseUrl}/api/v2/invitations`, { headers: { cookie: stranger } });

        expect(response.status).toBe(403);
        expect((await response.json()).error).toContain("not a member");
    });

    it("invites at a named role, and never as an owner", async () => {
        const invite = (role : string) => fetch(`${baseUrl}/api/v2/invitations`, {
            method: "POST", headers: { "content-type": "application/json", cookie: cookie() },
            body: JSON.stringify({ email: "fox@example.com", role }),
        });

        expect((await (await invite("ADMIN")).json()).role).toBe("ADMIN");
        expect((await invite("OWNER")).status).toBe(400);
        expect((await invite("SUPERUSER")).status).toBe(400);
    });

    it("rejects an address that is not an email", async () => {
        expect((await invite("fox")).status).toBe(400);
    });

    it("lists what is pending and revokes by token", async () => {
        const { token } = await (await invite("fox@example.com")).json();

        const pending = await (await fetch(`${baseUrl}/api/v2/invitations`, { headers: { cookie: cookie() } })).json();
        expect(pending.map((invitation : any) => invitation.token)).toEqual([token]);

        const remove = () => fetch(`${baseUrl}/api/v2/invitations/${token}`, { method: "DELETE", headers: { cookie: cookie() } });
        expect((await remove()).status).toBe(204);
        expect((await remove()).status).toBe(404);
        expect(await (await fetch(`${baseUrl}/api/v2/invitations`, { headers: { cookie: cookie() } })).json()).toEqual([]);
    });

});
