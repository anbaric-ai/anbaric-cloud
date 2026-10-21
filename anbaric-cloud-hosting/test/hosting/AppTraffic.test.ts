import {afterEach, beforeEach, describe, expect, it, Mock, vi} from "vitest";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {BuildLayer} from "../../src/app-management/BuildLayer";
import {HostingServer} from "../../src/hosting/HostingServer";
import {RemoteQueue} from "../../src/queuing/RemoteQueue";
import {TrafficRecorder} from "../../src/reporting/TrafficRecorder";

class ConfirmableInMemoryQueue extends InMemoryQueue implements RemoteQueue {

    async confirm(_message : QueueMessage) : Promise<void> {}

    async debounce(_message : QueueMessage) : Promise<void> {}

    async cancel(_message : QueueMessage) : Promise<void> {}

    async size() : Promise<number> {
        return 0;
    }

}

const runningApp = (appName : string, appPort : number) : BuildLayer => ({
    ensureHydrated: async () => {},
    deploy: () => { throw new Error("not deployable in this test"); },
    status: (name) => name === appName
        ? { appName, status: "running", serving: true, appPort, appHost: "127.0.0.1", size: "small", log: [] }
        : undefined,
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
});

const RESPONSES : Record<string, [number, string]> = {
    "/": [200, "text/html; charset=utf-8"],
    "/app.js": [200, "text/javascript"],
    "/api/orders": [200, "application/json"],
    "/missing": [404, "text/html"],
};

describe("traffic through the app proxy", () => {

    let server : HostingServer;
    let upstream : Server;
    let baseUrl : string;
    let traffic : { pageview : Mock<TrafficRecorder["pageview"]> };

    beforeEach(async () => {
        upstream = createServer((request, response) => {
            const [status, contentType] = RESPONSES[request.url ?? "/"] ?? [200, "text/html"];
            response.writeHead(status, { "content-type": contentType });
            response.end("ok");
        });
        await new Promise<void>(resolve => upstream.listen(0, resolve));

        traffic = { pageview: vi.fn<TrafficRecorder["pageview"]>() };
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined,
            runningApp("shop", (upstream.address() as AddressInfo).port), undefined, undefined, undefined, undefined, undefined, undefined, undefined, [],
            undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
            undefined, traffic satisfies TrafficRecorder);
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    });

    afterEach(async () => {
        await server.close();
        await new Promise<void>(resolve => upstream.close(() => resolve()));
    });

    it("records a page the app serves, against the app", async () => {
        await (await fetch(`${baseUrl}/app/shop/`)).text();

        expect(traffic.pageview).toHaveBeenCalledTimes(1);
        expect(traffic.pageview.mock.calls[0][1]).toBe("shop");
    });

    it("does not record scripts, API calls, failures or other methods", async () => {
        await (await fetch(`${baseUrl}/app/shop/app.js`)).text();
        await (await fetch(`${baseUrl}/app/shop/api/orders`)).text();
        await (await fetch(`${baseUrl}/app/shop/missing`)).text();
        await (await fetch(`${baseUrl}/app/shop/`, { method: "POST", body: "x" })).text();

        expect(traffic.pageview).not.toHaveBeenCalled();
    });

    it("does not record a page the browser only prefetched", async () => {
        await (await fetch(`${baseUrl}/app/shop/`, { headers: { "sec-purpose": "prefetch;prerender" } })).text();

        expect(traffic.pageview).not.toHaveBeenCalled();
    });

    it("still serves the page when recording fails", async () => {
        traffic.pageview.mockImplementation(() => { throw new Error("log unavailable"); });
        vi.spyOn(console, "warn").mockImplementation(() => {});

        const response = await fetch(`${baseUrl}/app/shop/`);

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("ok");
    });

});
