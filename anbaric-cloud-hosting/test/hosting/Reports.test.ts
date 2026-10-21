import {afterEach, describe, expect, it, vi} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {BuildLayer} from "../../src/app-management/BuildLayer";
import {InMemoryMembershipService} from "../../src/auth/InMemoryMembershipService";
import {SessionSigner} from "../../src/auth/SessionSigner";
import {Tenant} from "../../src/auth/Tenant";
import {User} from "../../src/auth/User";
import {HostingServer} from "../../src/hosting/HostingServer";
import {RemoteQueue} from "../../src/queuing/RemoteQueue";
import {TrafficReport} from "../../src/reporting/TrafficReport";

class ConfirmableInMemoryQueue extends InMemoryQueue implements RemoteQueue {

    async confirm(_message : QueueMessage) : Promise<void> {}

    async debounce(_message : QueueMessage) : Promise<void> {}

    async cancel(_message : QueueMessage) : Promise<void> {}

    async size() : Promise<number> {
        return 0;
    }

}

const SECRET = "reports-secret";

const noApps : BuildLayer = {
    ensureHydrated: async () => {},
    deploy: () => { throw new Error("not deployable in this test"); },
    status: () => undefined,
    list: () => [],
    resize: async () => undefined,
    ping: async () => true,
    logs: async function* () {},
    teardown: async () => undefined,
    consumerUrlFor: () => undefined,
    consumerUrlsFor: async () => [],
    appRemoved: () => {},
    regenerateDocs: async () => 0,
    cleanUp: async () => {},
};

const shopHour = { app: "shop", hour: "2026-10-21T12:00:00.000Z", pageviews: 40, sessions: 7 };

describe("traffic reports", () => {

    let server : HostingServer;
    let baseUrl : string;

    const serve = async (traffic? : TrafficReport) => {
        process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET;
        const memberships = new InMemoryMembershipService();
        memberships.add("builder", "BUILDER");
        memberships.add("reader", "USER");
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined, noApps,
            undefined, undefined, undefined, undefined, undefined, "acme",
            undefined, [], undefined, undefined, undefined, undefined, memberships,
            undefined, undefined, undefined, undefined, undefined, undefined, undefined,
            undefined, undefined, traffic);
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    };

    afterEach(async () => {
        delete process.env.ANBARIC_SESSION_SIGNING_SECRET;
        await server.close();
    });

    const get = (who : string, query : string = "") =>
        fetch(`${baseUrl}/api/v2/reports/traffic${query}`, {
            headers: { cookie: `anbaric_session=${new SessionSigner(SECRET).mint(new User(who), new Tenant("acme"))}` },
        });

    it("answers a builder each app's hours, over the last 48 unless asked", async () => {
        const traffic = { hourly: vi.fn(async () => [shopHour]) } satisfies TrafficReport;
        await serve(traffic);

        const response = await get("builder");

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ hours: 48, traffic: [shopHour] });
        expect(traffic.hourly).toHaveBeenCalledWith(48);
    });

    it("refuses someone whose role cannot build", async () => {
        await serve({ hourly: vi.fn(async () => [shopHour]) });

        expect((await get("reader")).status).toBe(403);
    });

    it("refuses a span that is not a whole number of hours up to 30 days", async () => {
        await serve({ hourly: vi.fn(async () => []) });

        expect((await get("builder", "?hours=0")).status).toBe(400);
        expect((await get("builder", "?hours=721")).status).toBe(400);
        expect((await get("builder", "?hours=1.5")).status).toBe(400);
        expect((await get("builder", "?hours=720")).status).toBe(200);
    });

    it("reads traffic once a minute however often it is asked", async () => {
        const traffic = { hourly: vi.fn(async () => [shopHour]) } satisfies TrafficReport;
        await serve(traffic);

        await get("builder", "?hours=24");
        await get("builder", "?hours=24");

        expect(traffic.hourly).toHaveBeenCalledTimes(1);
    });

    it("says why traffic cannot be read, and tries again next time", async () => {
        const traffic = { hourly: vi.fn(async () : Promise<Array<typeof shopHour>> => { throw new Error("AccessDeniedException"); }) } satisfies TrafficReport;
        await serve(traffic);
        vi.spyOn(console, "warn").mockImplementation(() => {});

        const response = await get("builder");
        await get("builder");

        expect(response.status).toBe(503);
        expect((await response.json()).error).toContain("AccessDeniedException");
        expect(traffic.hourly).toHaveBeenCalledTimes(2);
    });

    it("says when the platform keeps no traffic", async () => {
        await serve(undefined);

        expect((await get("builder")).status).toBe(409);
    });

});
