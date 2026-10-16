import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {AppSize, BuildLayer} from "../../src/app-management/BuildLayer";
import {InMemoryMembershipService} from "../../src/auth/InMemoryMembershipService";
import {SessionSigner} from "../../src/auth/SessionSigner";
import {Tenant} from "../../src/auth/Tenant";
import {User} from "../../src/auth/User";
import {InMemoryAppSettingsStore} from "../../src/data-store/InMemoryAppSettingsStore";
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

const SECRET = "zero-downtime-secret";

const summary = { appName: "crm", appHost: "crm", appPort: 3000, status: "running" as const, size: "small" as AppSize };

const stubBuildLayer = () => ({
    ensureHydrated: vi.fn(async () => {}),
    deploy: vi.fn(() => ({ ...summary, status: "building" as const })),
    status: vi.fn((appName : string) => appName === "crm" ? { ...summary, log: [] } : undefined),
    list: vi.fn(() => [summary]),
    ping: vi.fn(async () => true),
    logs: vi.fn(),
    resize: vi.fn(),
    teardown: vi.fn(async () => summary),
    regenerateDocs: vi.fn(async () => 0),
    cleanUp: vi.fn(async () => {}),
    consumerUrlsFor: async () => [],
    appRemoved: () => {},
}) as unknown as BuildLayer & { deploy : ReturnType<typeof vi.fn> };

describe("zero-downtime deploys for an app", () => {

    let server : HostingServer;
    let baseUrl : string;
    let buildLayer : ReturnType<typeof stubBuildLayer>;
    let settings : InMemoryAppSettingsStore;

    beforeEach(async () => {
        process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET;
        const memberships = new InMemoryMembershipService();
        memberships.add("builder", "BUILDER");
        memberships.add("reader", "USER");
        buildLayer = stubBuildLayer();
        settings = new InMemoryAppSettingsStore();
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined, buildLayer,
            undefined, undefined, undefined, undefined, undefined, "acme",
            undefined, [], undefined, undefined, undefined, undefined, memberships,
            undefined, undefined, undefined, undefined, settings);
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    });

    afterEach(async () => {
        delete process.env.ANBARIC_SESSION_SIGNING_SECRET;
        await server.close();
    });

    const as = (id : string) =>
        `anbaric_session=${new SessionSigner(SECRET).mint(new User(id), new Tenant("acme"))}`;

    const turn = (id : string, app : string, on : unknown) =>
        fetch(`${baseUrl}/api/v2/apps/${app}/zero-downtime`, {
            method: "PUT",
            headers: { "content-type": "application/json", cookie: as(id) },
            body: JSON.stringify({ on }),
        });

    it("is off for every app until a builder turns it on", async () => {
        const apps = await (await fetch(`${baseUrl}/api/v2/apps`, { headers: { cookie: as("builder") } })).json();

        expect(apps[0]).toMatchObject({ appName: "crm", zeroDowntime: false });
    });

    it("lets a builder turn it on, and the app then says so", async () => {
        const response = await turn("builder", "crm", true);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ appName: "crm", zeroDowntime: true });
        const app = await (await fetch(`${baseUrl}/api/v2/apps/crm`, { headers: { cookie: as("builder") } })).json();
        expect(app.zeroDowntime).toBe(true);
    });

    // The setting is a promise about the next deploy, which is where it is kept.
    it("is handed to the build layer with the next deploy", async () => {
        await turn("builder", "crm", true);

        await fetch(`${baseUrl}/api/v2/apps/crm/deploy?port=3000`, {
            method: "POST", headers: { cookie: as("builder") }, body: Buffer.from("tarball"),
        });

        expect(buildLayer.deploy).toHaveBeenCalledWith("crm", 3000, expect.any(Buffer), { zeroDowntime: true });
    });

    it("is forgotten when the app is torn down", async () => {
        await turn("builder", "crm", true);

        await fetch(`${baseUrl}/api/v2/apps/crm`, { method: "DELETE", headers: { cookie: as("builder") } });

        expect((await settings.get("crm")).zeroDowntime).toBe(false);
    });

    it("wants a boolean, an app that exists, and a builder", async () => {
        expect((await turn("builder", "crm", "yes")).status).toBe(400);
        expect((await turn("builder", "ghost", true)).status).toBe(404);
        expect((await turn("reader", "crm", true)).status).toBe(403);
    });

});
