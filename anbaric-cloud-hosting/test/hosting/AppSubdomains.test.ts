import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {BuildLayer} from "../../src/app-management/BuildLayer";
import {InMemoryMembershipService} from "../../src/auth/InMemoryMembershipService";
import {SessionSigner} from "../../src/auth/SessionSigner";
import {Tenant} from "../../src/auth/Tenant";
import {User} from "../../src/auth/User";
import {HostingServer} from "../../src/hosting/HostingServer";
import {RemoteQueue} from "../../src/queuing/RemoteQueue";
import {AppAddress, Subdomains} from "../../src/subdomains/Subdomains";

class ConfirmableInMemoryQueue extends InMemoryQueue implements RemoteQueue {

    async confirm(_message : QueueMessage) : Promise<void> {}

    async debounce(_message : QueueMessage) : Promise<void> {}

    async cancel(_message : QueueMessage) : Promise<void> {}

    async size() : Promise<number> {
        return 0;
    }

}

const SECRET = "app-subdomains-secret";

const summary = { appName: "crm", appHost: "crm", appPort: 3000, status: "running" as const };

const stubBuildLayer = () => ({
    ensureHydrated: vi.fn(async () => {}),
    deploy: vi.fn(() => ({ ...summary, status: "building" as const })),
    status: vi.fn(() => ({ ...summary, log: [] })),
    list: vi.fn(() => [summary]),
    ping: vi.fn(async () => true),
    logs: vi.fn(),
    teardown: vi.fn(async () => summary),
    regenerateDocs: vi.fn(async () => 0),
    cleanUp: vi.fn(async () => {}),
    consumerUrlsFor: () => [],
    appRemoved: () => {},
}) as unknown as BuildLayer;

const stubSubdomains = () => {
    const held = new Map<string, string>([["crm", "crm"]]);
    return {
        allocate: vi.fn(async (appName : string) : Promise<AppAddress> =>
            ({ appName, subdomain: held.get(appName) ?? appName, published: true })),
        set: vi.fn(async (appName : string, subdomain : string) : Promise<AppAddress> => {
            if (subdomain === "taken") throw new Error('"taken" is already in use as an address');
            held.set(appName, subdomain);
            return { appName, subdomain, published: true };
        }),
        release: vi.fn(async (appName : string) => { held.delete(appName); }),
        all: vi.fn(async () => [...held].map(([appName, subdomain]) => ({ appName, subdomain, published: true }))),
    };
};

describe("an app's address", () => {

    let server : HostingServer;
    let baseUrl : string;
    let buildLayer : BuildLayer;
    let subdomains : ReturnType<typeof stubSubdomains>;

    const start = async (withSubdomains : boolean) => {
        const memberships = new InMemoryMembershipService();
        memberships.add("builder", "BUILDER");
        memberships.add("reader", "USER");
        buildLayer = stubBuildLayer();
        subdomains = stubSubdomains();
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined, buildLayer,
            undefined, undefined, undefined, undefined, undefined, "acme",
            undefined, [], undefined, undefined, undefined, undefined, memberships,
            undefined, undefined, withSubdomains ? subdomains as unknown as Subdomains : undefined);
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    };

    beforeEach(async () => {
        process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET;
        process.env.ANBARIC_APP_HOST_SUFFIX = "cloud.example";
        await start(true);
    });

    afterEach(async () => {
        delete process.env.ANBARIC_SESSION_SIGNING_SECRET;
        delete process.env.ANBARIC_APP_HOST_SUFFIX;
        await server.close();
    });

    const as = (id : string) =>
        `anbaric_session=${new SessionSigner(SECRET).mint(new User(id), new Tenant("acme"))}`;

    const setTo = (id : string, subdomain : string) =>
        fetch(`${baseUrl}/api/v2/apps/crm/subdomain`, {
            method: "PUT",
            headers: { "content-type": "application/json", cookie: as(id) },
            body: JSON.stringify({ subdomain }),
        });

    it("is asked for as part of a deploy, and reported back with it", async () => {
        const response = await fetch(`${baseUrl}/api/v2/apps/crm/deploy?port=3000`, {
            method: "POST", headers: { cookie: as("builder") }, body: "a tarball",
        });

        expect(response.status).toBe(202);
        expect(await response.json()).toMatchObject({ appName: "crm", subdomain: "crm" });
        expect(subdomains.allocate).toHaveBeenCalledWith("crm");
    });

    it("appears beside each app in the listing", async () => {
        const response = await fetch(`${baseUrl}/api/v2/apps`, { headers: { cookie: as("reader") } });

        expect(await response.json()).toEqual([{ ...summary, subdomain: "crm", url: "https://crm.cloud.example" }]);
    });

    it("can be changed by a builder", async () => {
        expect((await setTo("builder", "sales")).status).toBe(200);
        expect(subdomains.set).toHaveBeenCalledWith("crm", "sales");
    });

    it("cannot be changed by a plain user", async () => {
        expect((await setTo("reader", "sales")).status).toBe(403);
        expect(subdomains.set).not.toHaveBeenCalled();
    });

    it("refuses one already in use, with the control plane's reason", async () => {
        const response = await setTo("builder", "taken");

        expect(response.status).toBe(409);
        expect((await response.json()).error).toContain("already in use");
    });

    // An app that drains is gone minutes after the teardown returns, so the
    // address is let go there rather than when the request is answered.
    it("is let go when the app is finally removed, not when teardown is asked for", async () => {
        await fetch(`${baseUrl}/api/v2/apps/crm`, { method: "DELETE", headers: { cookie: as("builder") } });
        expect(subdomains.release).not.toHaveBeenCalled();

        buildLayer.appRemoved("crm");
        expect(subdomains.release).toHaveBeenCalledWith("crm");
    });

    describe("on a platform with no control plane", () => {

        beforeEach(async () => {
            await server.close();
            await start(false);
        });

        it("is simply absent, and the app is still listed", async () => {
            const response = await fetch(`${baseUrl}/api/v2/apps`, { headers: { cookie: as("reader") } });

            // No address allocated, but a host suffix is configured - so the
            // app is served at its own name, which is what a self-hoster gets.
            expect(await response.json()).toEqual([{ ...summary, url: "https://crm.cloud.example" }]);
        });

        it("cannot be set, and says so rather than failing obscurely", async () => {
            const response = await setTo("builder", "sales");

            expect(response.status).toBe(409);
            expect((await response.json()).error).toContain("does not give its apps addresses");
        });

    });

});
