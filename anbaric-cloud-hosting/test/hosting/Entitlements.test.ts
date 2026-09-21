import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {CloudEntitlements} from "anbaric-impl-cloud";
import {SessionSigner} from "../../src/auth/SessionSigner";
import {Tenant} from "../../src/auth/Tenant";
import {User} from "../../src/auth/User";
import {InMemoryEntitlementStore} from "../../src/data-store/InMemoryEntitlementStore";
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

const SECRET = "entitlements-round-trip-secret";

describe("entitlements end to end: app registers and checks, console grants", () => {

    let server : HostingServer;
    let store : InMemoryEntitlementStore;
    let publicUrl : string;
    let internalUrl : string;
    let app : CloudEntitlements;

    beforeEach(async () => {
        process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET;
        process.env.ANBARIC_APP_ID = "crm";
        store = new InMemoryEntitlementStore();
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined, undefined,
            undefined, undefined, undefined, undefined, undefined, undefined, undefined, [], undefined, undefined, store);
        publicUrl = `http://127.0.0.1:${await server.listen(0)}`;
        internalUrl = `http://127.0.0.1:${await server.listenInternal(0)}`;
        app = new CloudEntitlements(internalUrl);
    });

    afterEach(async () => {
        delete process.env.ANBARIC_SESSION_SIGNING_SECRET;
        delete process.env.ANBARIC_APP_ID;
        await server.close();
    });

    const adminCookie = () =>
        `anbaric_session=${new SessionSigner(SECRET).mint(new User("admin-1"), new Tenant("acme"))}`;

    const grant = (body : object) => fetch(`${publicUrl}/api/v2/entitlements/grants`, {
        method: "POST", headers: { "content-type": "application/json", cookie: adminCookie() }, body: JSON.stringify(body),
    });

    it("seeds the global access entitlement", async () => {
        const response = await fetch(`${publicUrl}/api/v2/entitlements`);

        expect(await response.json()).toEqual([{ appId: null, entitlementId: "access", notes: "Global access" }]);
    });

    it("registers an app-scoped definition through the app client", async () => {
        await app.register("crm", "export", "Can export reports");

        expect(await store.listDefinitions()).toContainEqual({ appId: "crm", entitlementId: "export", notes: "Can export reports" });
    });

    it("refuses to register or check without the app header", async () => {
        const registered = await fetch(`${internalUrl}/api/v2/entitlements`, {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entitlementId: "x" }),
        });
        const checked = await fetch(`${internalUrl}/api/v2/entitlements/x/check?userId=ada`);

        expect(registered.status).toBe(400);
        expect(checked.status).toBe(400);
    });

    it("an app-scoped grant is held, then revoked", async () => {
        expect(await app.has("crm", "ada", "export")).toBe(false);

        const created = await grant({ userId: "ada", appId: "crm", entitlementId: "export", notes: "trial" });
        const granted = await created.json();

        expect(created.status).toBe(201);
        expect(granted).toMatchObject({ userId: "ada", appId: "crm", entitlementId: "export", notes: "trial", grantedBy: "admin-1" });
        expect(await app.has("crm", "ada", "export")).toBe(true);

        const revoked = await fetch(`${publicUrl}/api/v2/entitlements/grants/${granted.id}`, { method: "DELETE" });

        expect(revoked.status).toBe(204);
        expect(await app.has("crm", "ada", "export")).toBe(false);
    });

    it("a global grant satisfies any app's check, an app-scoped one only its own", async () => {
        await grant({ userId: "ada", appId: null, entitlementId: "access" });
        await grant({ userId: "bob", appId: "crm", entitlementId: "access" });

        expect(await app.has("crm", "ada", "access")).toBe(true);
        expect(await app.has("crm", "bob", "access")).toBe(true);
        expect(await store.has("billing", "ada", "access")).toBe(true);
        expect(await store.has("billing", "bob", "access")).toBe(false);
    });

    it("creates a global definition from the console, and lists grants per user", async () => {
        const defined = await fetch(`${publicUrl}/api/v2/entitlements/definitions`, {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ entitlementId: "beta", notes: "Beta features" }),
        });
        await grant({ userId: "ada", appId: null, entitlementId: "beta" });
        await grant({ userId: "bob", appId: null, entitlementId: "beta" });

        const grants = await (await fetch(`${publicUrl}/api/v2/entitlements/grants?userId=ada`)).json();

        expect(defined.status).toBe(204);
        expect(await store.listDefinitions()).toContainEqual({ appId: null, entitlementId: "beta", notes: "Beta features" });
        expect(grants).toHaveLength(1);
        expect(grants[0]).toMatchObject({ userId: "ada", entitlementId: "beta" });
    });

    it("never exposes granting on the app-facing entry point", async () => {
        const response = await fetch(`${internalUrl}/api/v2/entitlements/grants`, {
            method: "POST", headers: { "content-type": "application/json", "x-anbaric-app": "crm" },
            body: JSON.stringify({ userId: "ada", entitlementId: "access" }),
        });

        expect(response.status).toBe(404);
        expect(await store.listGrants()).toEqual([]);
    });

    it("revoking an unknown grant is a 404", async () => {
        const response = await fetch(`${publicUrl}/api/v2/entitlements/grants/nope`, { method: "DELETE" });

        expect(response.status).toBe(404);
    });

});
