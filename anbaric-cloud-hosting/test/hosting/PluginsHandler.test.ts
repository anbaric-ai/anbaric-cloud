import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {BuildLayer} from "../../src/app-management/BuildLayer";
import {HostingServer} from "../../src/hosting/HostingServer";
import {LoadedPlugin} from "../../src/plugins/Plugin";
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

const testPlugin : LoadedPlugin = {
    name: "test-plugin",
    plugin: {
        name: "test-plugin",
        pages: [{ path: "/testing", title: "Testing", icon: "info", navOrder: 5 }],
        widgets: [
            {
                page: "/testing",
                id: "counter",
                title: "Counter",
                position: 1,
                component: () => null,
                data: async (parameters) => ({ echoed: parameters }),
            },
            { page: "/", id: "plain", component: () => null },
        ],
    },
    bundle: "export const marker = 'compiled-test-plugin-bundle';",
};

const runningApp = (appName : string) : BuildLayer => ({
    ensureHydrated: async () => {},
    deploy: () => { throw new Error("not deployable in this test"); },
    status: (name) => name === appName
        ? { appName, status: "running", appPort: 1, appHost: "localhost", log: [] }
        : undefined,
    list: () => [{ appName, status: "running", appPort: 1, appHost: "localhost" }],
    ping: async () => true,
    logs: async function* () {},
    teardown: async () => true,
    regenerateDocs: async () => 0,
    cleanUp: async () => {},
});

describe("PluginsHandler through the hosting server", () => {

    let server : HostingServer;
    let baseUrl : string;

    beforeEach(async () => {
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined,
            runningApp("testing"), undefined, undefined, undefined, undefined, undefined, undefined, undefined,
            [testPlugin]);
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    });

    afterEach(async () => {
        await server.close();
    });

    it("serves the manifest describing pages and widgets without their code", async () => {
        const manifest = await (await fetch(`${baseUrl}/api/v2/plugins`)).json();

        expect(manifest).toEqual([{
            name: "test-plugin",
            bundle: "/api/v2/plugins/test-plugin.js",
            pages: [{ path: "/testing", title: "Testing", icon: "info", navOrder: 5 }],
            widgets: [
                { page: "/testing", id: "counter", title: "Counter", position: 1, hasData: true },
                { page: "/", id: "plain", hasData: false },
            ],
        }]);
    });

    it("serves the compiled bundle as javascript", async () => {
        const response = await fetch(`${baseUrl}/api/v2/plugins/test-plugin.js`);

        expect(response.headers.get("content-type")).toBe("text/javascript");
        expect(await response.text()).toContain("compiled-test-plugin-bundle");
    });

    it("404s an unknown bundle", async () => {
        expect((await fetch(`${baseUrl}/api/v2/plugins/unknown.js`)).status).toBe(404);
    });

    it("runs a widget data function with the remaining query parameters", async () => {
        const response = await fetch(`${baseUrl}/api/v2/plugins/data?plugin=test-plugin&widget=counter&colour=red`);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ echoed: { colour: "red" } });
    });

    it("404s a data call for a widget without a data function", async () => {
        const response = await fetch(`${baseUrl}/api/v2/plugins/data?plugin=test-plugin&widget=plain`);

        expect(response.status).toBe(404);
        expect((await response.json()).error).toContain('No data function found for widget "plain"');
    });

    it("404s a data call for an unknown plugin", async () => {
        expect((await fetch(`${baseUrl}/api/v2/plugins/data?plugin=nope&widget=counter`)).status).toBe(404);
    });

    it("does not serve plugin page paths - the console routes them client-side", async () => {
        expect((await fetch(`${baseUrl}/testing`)).status).toBe(404);
    });

    it("404s an unknown app under /app", async () => {
        expect((await fetch(`${baseUrl}/app/other-app`)).status).toBe(404);
    });

});
