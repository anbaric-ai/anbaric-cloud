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

const SECRET = "invited-entitlements-secret";

describe("entitlements chosen before someone arrives", () => {

    let server : HostingServer;
    let baseUrl : string;
    let entitlements : InMemoryEntitlementStore;
    let memberships : InMemoryMembershipService;

    beforeEach(async () => {
        process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET;
        entitlements = new InMemoryEntitlementStore();
        memberships = new InMemoryMembershipService("https://central.example/invitations");
        memberships.add("ada", "OWNER");
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

    const as = (id : string, email? : string) =>
        `anbaric_session=${new SessionSigner(SECRET).mint(new User(id, [], [], id, undefined, email), new Tenant("acme"))}`;

    const invite = (body : unknown) => fetch(`${baseUrl}/api/v2/invitations`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: as("ada") },
        body: JSON.stringify(body),
    });

    const signIn = (id : string, email : string) =>
        fetch(`${baseUrl}/api/v2/whoami`, { headers: { cookie: as(id, email) } });

    it("puts the chosen entitlements aside against the email address", async () => {
        const response = await invite({
            email: "fox@example.com",
            entitlements: [{ appId: "crm", entitlementId: "access" }, { appId: null, entitlementId: "approve" }],
        });

        expect(await response.json()).toMatchObject({ entitlements: 2 });
        expect(await entitlements.offersFor("fox@example.com")).toEqual([
            { email: "fox@example.com", appId: "crm", entitlementId: "access", notes: "" },
            { email: "fox@example.com", appId: null, entitlementId: "approve", notes: "" },
        ]);
    });

    it("grants nothing yet, because there is nobody to grant it to", async () => {
        await invite({ email: "fox@example.com", entitlements: [{ appId: "crm", entitlementId: "access" }] });

        expect(await entitlements.listGrants()).toEqual([]);
    });

    /* The first sign-in is the first moment that person has a user id, which
       is what a grant is made against. */
    it("turns them into real grants the first time that person signs in", async () => {
        await invite({ email: "fox@example.com", entitlements: [{ appId: "crm", entitlementId: "access" }] });

        await signIn("fox", "fox@example.com");

        expect(await entitlements.listGrants("fox"))
            .toMatchObject([{ userId: "fox", appId: "crm", entitlementId: "access", grantedBy: "ada" }]);
        expect(await entitlements.offersFor("fox@example.com")).toEqual([]);
    });

    it("does not grant them to somebody else who signs in", async () => {
        await invite({ email: "fox@example.com", entitlements: [{ appId: "crm", entitlementId: "access" }] });

        await signIn("dana", "dana@example.com");

        expect(await entitlements.listGrants("dana")).toEqual([]);
        expect(await entitlements.offersFor("fox@example.com")).toHaveLength(1);
    });

    it("carries the app the invitation should land on through to the invitation", async () => {
        await invite({ email: "fox@example.com", landingApp: "crm" });

        expect((await memberships.pending({ id: "ada" }))[0]).toMatchObject({ landingApp: "crm" });
    });

    it("invites with nothing chosen, as it always did", async () => {
        const response = await invite({ email: "fox@example.com" });

        expect(await response.json()).toMatchObject({ email: "fox@example.com", entitlements: 0 });
        expect(await entitlements.offersFor("fox@example.com")).toEqual([]);
    });

    it("ignores an entitlement with no name rather than storing an empty one", async () => {
        await invite({ email: "fox@example.com", entitlements: [{ appId: "crm" }, { entitlementId: "" }] });

        expect(await entitlements.offersFor("fox@example.com")).toEqual([]);
    });

});
