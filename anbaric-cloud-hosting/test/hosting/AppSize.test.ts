import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {AppSize, BuildLayer} from "../../src/app-management/BuildLayer";
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

const SECRET = "app-size-secret";

const summary = { appName: "crm", appHost: "crm", appPort: 3000, status: "running" as const, size: "small" as AppSize };

const stubBuildLayer = () => ({
    ensureHydrated: vi.fn(async () => {}),
    deploy: vi.fn(() => ({ ...summary, status: "building" as const })),
    status: vi.fn(() => ({ ...summary, log: [] })),
    list: vi.fn(() => [summary]),
    ping: vi.fn(async () => true),
    logs: vi.fn(),
    resize: vi.fn(async (appName : string, size : AppSize) => appName === "crm" ? { ...summary, size } : undefined),
    teardown: vi.fn(async () => summary),
    regenerateDocs: vi.fn(async () => 0),
    cleanUp: vi.fn(async () => {}),
    consumerUrlsFor: () => [],
    appRemoved: () => {},
}) as unknown as BuildLayer & { resize : ReturnType<typeof vi.fn> };

describe("an app's size", () => {

    let server : HostingServer;
    let baseUrl : string;
    let buildLayer : ReturnType<typeof stubBuildLayer>;

    beforeEach(async () => {
        process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET;
        const memberships = new InMemoryMembershipService();
        memberships.add("builder", "BUILDER");
        memberships.add("reader", "USER");
        buildLayer = stubBuildLayer();
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined, buildLayer,
            undefined, undefined, undefined, undefined, undefined, "acme",
            undefined, [], undefined, undefined, undefined, undefined, memberships);
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    });

    afterEach(async () => {
        delete process.env.ANBARIC_SESSION_SIGNING_SECRET;
        await server.close();
    });

    const as = (id : string) =>
        `anbaric_session=${new SessionSigner(SECRET).mint(new User(id), new Tenant("acme"))}`;

    const setSize = (id : string, app : string, size : unknown) =>
        fetch(`${baseUrl}/api/v2/apps/${app}/size`, {
            method: "PUT",
            headers: { "content-type": "application/json", cookie: as(id) },
            body: JSON.stringify({ size }),
        });

    it("is reported with the app", async () => {
        const apps = await (await fetch(`${baseUrl}/api/v2/apps`, { headers: { cookie: as("builder") } })).json();

        expect(apps[0]).toMatchObject({ appName: "crm", size: "small" });
    });

    it("lets a builder move an app to a large instance", async () => {
        const response = await setSize("builder", "crm", "large");

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ appName: "crm", size: "large" });
        expect(buildLayer.resize).toHaveBeenCalledWith("crm", "large");
    });

    it("refuses a size it does not have", async () => {
        expect((await setSize("builder", "crm", "huge")).status).toBe(400);
        expect(buildLayer.resize).not.toHaveBeenCalled();
    });

    it("is a 404 for an app that is not there", async () => {
        expect((await setSize("builder", "ghost", "large")).status).toBe(404);
    });

    it("is not a user's to change", async () => {
        expect((await setSize("reader", "crm", "large")).status).toBe(403);
        expect(buildLayer.resize).not.toHaveBeenCalled();
    });

});
