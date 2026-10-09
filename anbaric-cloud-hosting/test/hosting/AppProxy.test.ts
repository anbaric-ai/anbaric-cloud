import {afterEach, describe, expect, it, vi} from "vitest";
import {createServer, get, Server} from "node:http";
import {AddressInfo} from "node:net";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {BuildLayer} from "../../src/app-management/BuildLayer";
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

const runningApp = (appName : string, appHost : string, appPort : number) : BuildLayer => ({
    ensureHydrated: async () => {},
    deploy: () => { throw new Error("not deployable in this test"); },
    status: (name) => name === appName
        ? { appName, status: "running", appPort, appHost, size: "small", log: [] }
        : undefined,
    list: () => [],
    resize: async () => undefined,
    ping: async () => true,
    logs: async function* () {},
    teardown: async () => undefined,
    consumerUrlsFor: () => [],
    appRemoved: () => {},
    regenerateDocs: async () => 0,
    cleanUp: async () => {},
});

const serve = async (buildLayer : BuildLayer) : Promise<{ server : HostingServer, baseUrl : string }> => {
    const server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined,
        buildLayer, undefined, undefined, undefined, undefined, undefined, undefined, undefined, []);
    return { server, baseUrl: `http://127.0.0.1:${await server.listen(0)}` };
};

describe("app proxy through the hosting server", () => {

    let server : HostingServer;
    let upstream : Server;
    let received : Array<{ url : string, headers : Record<string, any> }>;

    const startUpstream = async () : Promise<number> => {
        received = [];
        upstream = createServer((request, response) => {
            received.push({ url: request.url!, headers: request.headers });
            if (request.url?.startsWith("/go")) {
                response.writeHead(302, { location: "/next", "set-cookie": "sid=xyz; Path=/" });
                return response.end();
            }
            response.writeHead(200, { "content-type": "text/plain", "set-cookie": "sid=abc; Path=/" });
            response.end(`prefix=${request.headers["x-forwarded-prefix"]} cookie=${request.headers.cookie ?? ""}`);
        });
        await new Promise<void>(resolve => upstream.listen(0, resolve));
        return (upstream.address() as AddressInfo).port;
    };

    afterEach(async () => {
        await server.close();
        await new Promise<void>(resolve => upstream.close(() => resolve()));
    });

    it("strips the app prefix, forwards the sub-path, query, cookies and an X-Forwarded-Prefix", async () => {
        const port = await startUpstream();
        const started = await serve(runningApp("myapp", "127.0.0.1", port));
        server = started.server;

        const response = await fetch(`${started.baseUrl}/app/myapp/hello?x=1`, { headers: { cookie: "s=1" } });

        expect(received[0].url).toBe("/hello?x=1");
        expect(received[0].headers["x-forwarded-prefix"]).toBe("/app/myapp");
        expect(await response.text()).toBe("prefix=/app/myapp cookie=s=1");
    });

    it("passes the app's Set-Cookie back to the client", async () => {
        const port = await startUpstream();
        const started = await serve(runningApp("myapp", "127.0.0.1", port));
        server = started.server;

        const response = await fetch(`${started.baseUrl}/app/myapp/`);

        expect(response.headers.get("set-cookie")).toContain("sid=abc");
    });

    /* Streams end for reasons that are nobody's failure: the browser closes
       the tab, or the app drops the connection. The platform must shrug off
       both - the one that got through to its error handler was taking the
       whole process down with every dropped event stream. */
    describe("a response that is cut off mid-stream", () => {

        let streaming : Server;
        const upstreamSockets : Array<import("node:net").Socket> = [];

        const startStreamingUpstream = async () : Promise<number> => {
            streaming = createServer((request, response) => {
                response.writeHead(200, { "content-type": "text/event-stream" });
                response.write("data: hello\n\n");
                upstreamSockets.push(request.socket);
                if (request.url === "/drop") setTimeout(() => request.socket.destroy(), 20);
            });
            await new Promise<void>(resolve => streaming.listen(0, resolve));
            return (streaming.address() as AddressInfo).port;
        };

        afterEach(async () => {
            for (const socket of upstreamSockets.splice(0)) socket.destroy();
            await new Promise<void>(resolve => streaming.close(() => resolve()));
        });

        it("lets go of the app when the client goes away, and keeps serving", async () => {
            const port = await startStreamingUpstream();
            await startUpstream();
            const started = await serve(runningApp("myapp", "127.0.0.1", port));
            server = started.server;

            const controller = new AbortController();
            const response = await fetch(`${started.baseUrl}/app/myapp/events`, { signal: controller.signal });
            expect(response.status).toBe(200);
            controller.abort();

            await vi.waitFor(() => expect(upstreamSockets[0].destroyed).toBe(true));
            expect((await fetch(`${started.baseUrl}/app/myapp/events`, { signal: AbortSignal.timeout(2000) })).status).toBe(200);
        });

        it("ends the request when the app drops the connection, and keeps serving", async () => {
            const port = await startStreamingUpstream();
            await startUpstream();
            const started = await serve(runningApp("myapp", "127.0.0.1", port));
            server = started.server;

            const response = await fetch(`${started.baseUrl}/app/myapp/drop`);
            expect(response.status).toBe(200);
            await expect(response.text()).rejects.toThrow();

            expect((await fetch(`${started.baseUrl}/app/myapp/events`, { signal: AbortSignal.timeout(2000) })).status).toBe(200);
        });

    });

    it("passes the app's redirect through instead of following it", async () => {
        const port = await startUpstream();
        const started = await serve(runningApp("myapp", "127.0.0.1", port));
        server = started.server;

        const redirect = await new Promise<{ status : number, location : string }>((resolve) => {
            get(`${started.baseUrl}/app/myapp/go`, response => {
                response.resume();
                resolve({ status: response.statusCode ?? 0, location: response.headers.location ?? "" });
            });
        });

        expect(redirect.status).toBe(302);
        expect(redirect.location).toBe("/next");
    });

});
