import {afterEach, describe, expect, it} from "vitest";
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

const appWithLogs = (appName : string, lines : Array<string>) : BuildLayer => ({
    ensureHydrated: async () => {},
    deploy: () => { throw new Error("not deployable in this test"); },
    status: (name) => name === appName
        ? { appName, status: "running", appPort: 1, appHost: "localhost", log: [] }
        : undefined,
    list: () => [],
    ping: async () => true,
    logs: async function* (_name, signal) {
        for (const line of lines) {
            if (signal.aborted) return;
            yield line;
        }
    },
    teardown: async () => true,
    cleanUp: async () => {},
});

const serve = async (buildLayer : BuildLayer) : Promise<{ server : HostingServer, baseUrl : string }> => {
    const server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined,
        buildLayer, undefined, undefined, undefined, undefined, undefined, undefined, undefined, []);
    return { server, baseUrl: `http://127.0.0.1:${await server.listen(0)}` };
};

describe("app runtime log streaming through the hosting server", () => {

    let server : HostingServer;

    afterEach(async () => { await server.close(); });

    it("streams the app's runtime log lines as a plain-text response", async () => {
        const started = await serve(appWithLogs("crm", ["line one", "line two"]));
        server = started.server;

        const response = await fetch(`${started.baseUrl}/api/v2/apps/crm/logs`);

        expect(response.headers.get("content-type")).toContain("text/plain");
        expect(await response.text()).toBe("line one\nline two\n");
    });

    it("404s for an unknown app", async () => {
        const started = await serve(appWithLogs("crm", []));
        server = started.server;

        expect((await fetch(`${started.baseUrl}/api/v2/apps/ghost/logs`)).status).toBe(404);
    });

});
