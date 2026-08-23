import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {PlatformClient} from "../src/PlatformClient";
import {AppTearDownCommand} from "../src/commands/AppTearDownCommand";

type Recorded = { method : string, path : string };

const stubPlatform = (recorded : Array<Recorded>) : Promise<{ server : Server, baseUrl : string }> =>
    new Promise(resolve => {
        const server = createServer((request, response) => {
            recorded.push({ method: request.method ?? "", path: request.url ?? "" });
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify({ appName: "crm", status: "stopped" }));
        });
        server.listen(0, () => resolve({
            server,
            baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        }));
    });

describe("AppTearDownCommand", () => {

    let server : Server;
    let recorded : Array<Recorded>;

    beforeEach(() => { recorded = []; });
    afterEach(() => server?.close());

    it("deletes the app when confirmation is skipped with --yes", async () => {
        const stub = await stubPlatform(recorded);
        server = stub.server;

        const code = await new AppTearDownCommand(new PlatformClient({ platformUrl: stub.baseUrl }), true).run("crm");

        expect(code).toBe(0);
        expect(recorded).toContainEqual({ method: "DELETE", path: "/api/v2/apps/crm" });
    });

    it("aborts without deleting when not confirmed (non-interactive, no --yes)", async () => {
        const stub = await stubPlatform(recorded);
        server = stub.server;

        const code = await new AppTearDownCommand(new PlatformClient({ platformUrl: stub.baseUrl }), false).run("crm");

        expect(code).toBe(1);
        expect(recorded).toHaveLength(0);
    });

});
