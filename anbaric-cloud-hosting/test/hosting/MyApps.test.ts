import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {BuildLayer} from "../../src/app-management/BuildLayer";
import {InMemoryEntitlementStore} from "../../src/data-store/InMemoryEntitlementStore";
import {InMemoryMembershipService} from "../../src/auth/InMemoryMembershipService";
import {SessionSigner} from "../../src/auth/SessionSigner";
import {Tenant} from "../../src/auth/Tenant";
import {User} from "../../src/auth/User";
import {HostingServer} from "../../src/hosting/HostingServer";
import {RemoteQueue} from "../../src/queuing/RemoteQueue";
import {Subdomains} from "../../src/subdomains/Subdomains";

class ConfirmableInMemoryQueue extends InMemoryQueue implements RemoteQueue {

    async confirm(_message : QueueMessage) : Promise<void> {}

    async debounce(_message : QueueMessage) : Promise<void> {}

    async cancel(_message : QueueMessage) : Promise<void> {}

    async size() : Promise<number> {
        return 0;
    }

}

const SECRET = "my-apps-secret";

const app = (appName : string) => ({ appName, appHost: appName, appPort: 3000, status: "running" as const });

const stubBuildLayer = (names : Array<string>) => ({
    ensureHydrated: vi.fn(async () => {}),
    deploy: vi.fn(),
    status: vi.fn((name : string) => names.includes(name) ? { ...app(name), log: [] } : undefined),
    list: vi.fn(() => names.map(app)),
    ping: vi.fn(async () => true),
    logs: vi.fn(),
    teardown: vi.fn(async () => undefined),
    regenerateDocs: vi.fn(async () => 0),
    cleanUp: vi.fn(async () => {}),
    consumerUrlsFor: () => [],
    appRemoved: () => {},
}) as unknown as BuildLayer;

const stubSubdomains = (addresses : Record<string, string>) => ({
    allocate: vi.fn(async () => undefined),
    set: vi.fn(),
    release: vi.fn(async () => {}),
    all: vi.fn(async () => Object.entries(addresses)
        .map(([appName, subdomain]) => ({ appName, subdomain, published: true }))),
}) as unknown as Subdomains;

describe("the apps a person may open", () => {

    let server : HostingServer;
    let baseUrl : string;
    let entitlements : InMemoryEntitlementStore;

    beforeEach(async () => {
        process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET;
        process.env.ANBARIC_APP_HOST_SUFFIX = "cloud.example";
        entitlements = new InMemoryEntitlementStore();
        const memberships = new InMemoryMembershipService();
        memberships.add("owner", "OWNER");
        memberships.add("reader", "USER");
        memberships.add("other", "USER");

        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined,
            stubBuildLayer(["crm", "invoices"]),
            undefined, undefined, undefined, undefined, undefined, "acme",
            undefined, [], undefined, undefined, entitlements, undefined, memberships,
            undefined, undefined, stubSubdomains({ crm: "crm", invoices: "acme-invoices" }));
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    });

    afterEach(async () => {
        delete process.env.ANBARIC_SESSION_SIGNING_SECRET;
        delete process.env.ANBARIC_APP_HOST_SUFFIX;
        await server.close();
    });

    const as = (id : string) =>
        `anbaric_session=${new SessionSigner(SECRET).mint(new User(id), new Tenant("acme"))}`;

    const mine = async (id : string) => {
        const response = await fetch(`${baseUrl}/api/v2/my-apps`, { headers: { cookie: as(id) } });
        return { status: response.status, apps: await response.json() as Array<{ appName : string, subdomain? : string }> };
    };

    it("shows nothing to someone who has been granted nothing", async () => {
        expect((await mine("reader")).apps).toEqual([]);
    });

    it("shows the one app someone was granted access to", async () => {
        await entitlements.grant("reader", "crm", "access", "", "owner");

        expect((await mine("reader")).apps.map(found => found.appName)).toEqual(["crm"]);
    });

    // A global grant is the existing "every app" scope, the same one
    // Entitlements.has already honours from any app.
    it("shows every app to someone granted access globally", async () => {
        await entitlements.grant("reader", null, "access", "", "owner");

        expect((await mine("reader")).apps.map(found => found.appName)).toEqual(["crm", "invoices"]);
    });

    it("does not let another entitlement stand in for access", async () => {
        await entitlements.grant("reader", "crm", "approve-invoices", "", "owner");

        expect((await mine("reader")).apps).toEqual([]);
    });

    it("keeps one person's grants out of another's directory", async () => {
        await entitlements.grant("reader", "crm", "access", "", "owner");

        expect((await mine("other")).apps).toEqual([]);
    });

    it("tells the directory where each app answers", async () => {
        await entitlements.grant("reader", null, "access", "", "owner");

        expect((await mine("reader")).apps).toEqual([
            { appName: "crm", status: "running", subdomain: "crm", url: "https://crm.cloud.example" },
            { appName: "invoices", status: "running", subdomain: "acme-invoices", url: "https://acme-invoices.cloud.example" },
        ]);
    });

});
