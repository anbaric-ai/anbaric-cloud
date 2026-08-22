import {afterEach, describe, expect, it} from "vitest";
import {createServer, get, Server} from "node:http";
import {AddressInfo} from "node:net";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {BuildLayer} from "../../src/app-management/BuildLayer";
import {HostingServer} from "../../src/hosting/HostingServer";
import {ConfirmableQueue} from "../../src/queuing/ConfirmableQueue";

class ConfirmableInMemoryQueue extends InMemoryQueue implements ConfirmableQueue {

    async confirm(_message : QueueMessage) : Promise<void> {
    }

    async size() : Promise<number> {
        return 0;
    }

}

const runningApp = (appName : string, appHost : string, appPort : number) : BuildLayer => ({
    ensureHydrated: async () => {},
    deploy: () => { throw new Error("not deployable in this test"); },
    status: (name) => name === appName
        ? { appName, status: "running", appPort, appHost, log: [] }
        : undefined,
    list: () => [],
    ping: async () => true,
    logs: async function* () {},
    teardown: async () => true,
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

        const response = await fetch(`${started.baseUrl}/myapp/hello?x=1`, { headers: { cookie: "s=1" } });

        expect(received[0].url).toBe("/hello?x=1");
        expect(received[0].headers["x-forwarded-prefix"]).toBe("/myapp");
        expect(await response.text()).toBe("prefix=/myapp cookie=s=1");
    });

    it("passes the app's Set-Cookie back to the client", async () => {
        const port = await startUpstream();
        const started = await serve(runningApp("myapp", "127.0.0.1", port));
        server = started.server;

        const response = await fetch(`${started.baseUrl}/myapp/`);

        expect(response.headers.get("set-cookie")).toContain("sid=abc");
    });

    it("passes the app's redirect through instead of following it", async () => {
        const port = await startUpstream();
        const started = await serve(runningApp("myapp", "127.0.0.1", port));
        server = started.server;

        const redirect = await new Promise<{ status : number, location : string }>((resolve) => {
            get(`${started.baseUrl}/myapp/go`, response => {
                response.resume();
                resolve({ status: response.statusCode ?? 0, location: response.headers.location ?? "" });
            });
        });

        expect(redirect.status).toBe(302);
        expect(redirect.location).toBe("/next");
    });

});
