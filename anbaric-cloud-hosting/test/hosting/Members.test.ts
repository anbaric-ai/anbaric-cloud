import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {InMemoryEntitlementStore} from "../../src/data-store/InMemoryEntitlementStore";
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

const SECRET = "members-secret";

describe("removing someone from the tenant", () => {

    let server : HostingServer;
    let baseUrl : string;
    let memberships : InMemoryMembershipService;
    let entitlements : InMemoryEntitlementStore;

    beforeEach(async () => {
        process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET;
        memberships = new InMemoryMembershipService();
        entitlements = new InMemoryEntitlementStore();
        memberships.add("ada", "OWNER");
        memberships.add("bob", "BUILDER");
        memberships.add("fox", "USER");

        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined, undefined,
            undefined, undefined, undefined, undefined, undefined, "acme", undefined, [], undefined, undefined,
            entitlements, undefined, memberships);
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    });

    afterEach(async () => {
        delete process.env.ANBARIC_SESSION_SIGNING_SECRET;
        await server.close();
    });

    const as = (id : string) =>
        `anbaric_session=${new SessionSigner(SECRET).mint(new User(id), new Tenant("acme"))}`;

    const remove = (who : string, target : string) =>
        fetch(`${baseUrl}/api/v2/members/${encodeURIComponent(target)}`, { method: "DELETE", headers: { cookie: as(who) } });

    it("lets an owner remove a member, who then has no role", async () => {
        expect((await remove("ada", "fox")).status).toBe(204);
        expect(await memberships.roleFor("fox")).toBeUndefined();
    });

    // Nothing should stay granted to somebody who can no longer sign in.
    it("takes the person's entitlements with them", async () => {
        await entitlements.grant("fox", "crm", "access", "", "ada");
        await entitlements.grant("bob", "crm", "access", "", "ada");

        await remove("ada", "fox");

        expect(await entitlements.listGrants("fox")).toEqual([]);
        expect(await entitlements.listGrants("bob")).toHaveLength(1);
    });

    it("refuses a builder, who may not administer membership", async () => {
        expect((await remove("bob", "fox")).status).toBe(403);
        expect(await memberships.roleFor("fox")).toBe("USER");
    });

    it("refuses removing yourself", async () => {
        const response = await remove("ada", "ada");

        expect(response.status).toBe(400);
        expect((await response.json()).error).toContain("yourself");
    });

    it("is a 404 for somebody who was never a member", async () => {
        expect((await remove("ada", "stranger")).status).toBe(404);
    });

    describe("changing a role", () => {

        const change = (who : string, target : string, role : string) =>
            fetch(`${baseUrl}/api/v2/members/${encodeURIComponent(target)}`, {
                method: "PATCH",
                headers: { "content-type": "application/json", cookie: as(who) },
                body: JSON.stringify({ role }),
            });

        it("lets an owner make a user a builder, and says so", async () => {
            const response = await change("ada", "fox", "BUILDER");

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ userId: "fox", role: "BUILDER" });
            expect(await memberships.roleFor("fox")).toBe("BUILDER");
        });

        it("refuses a builder, and refuses changing yourself", async () => {
            expect((await change("bob", "fox", "ADMIN")).status).toBe(403);
            expect((await change("ada", "ada", "USER")).status).toBe(400);
            expect(await memberships.roleFor("fox")).toBe("USER");
        });

        it("never hands out ownership, and refuses a role it does not know", async () => {
            expect((await change("ada", "fox", "OWNER")).status).toBe(400);
            expect((await change("ada", "fox", "SUPERUSER")).status).toBe(400);
        });

        it("is a 404 for somebody who was never a member", async () => {
            expect((await change("ada", "stranger", "USER")).status).toBe(404);
        });

    });

});
