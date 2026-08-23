import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {PlatformClient} from "../src/PlatformClient";
import {AppTailCommand} from "../src/commands/AppTailCommand";

const streamingPlatform = (lines : Array<string>) : Promise<{ server : Server, baseUrl : string, path? : string }> =>
    new Promise(resolve => {
        const state : { path? : string } = {};
        const server = createServer((request, response) => {
            state.path = request.url;
            response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
            for (const line of lines) response.write(`${line}\n`);
            response.end();
        });
        server.listen(0, () => resolve({
            server,
            baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
            get path() { return state.path; },
        }));
    });

describe("AppTailCommand", () => {

    let server : Server;
    let stdout : Array<string>;

    beforeEach(() => {
        stdout = [];
        vi.spyOn(process.stdout, "write").mockImplementation((chunk : any) => { stdout.push(String(chunk)); return true; });
    });

    afterEach(() => { vi.restoreAllMocks(); server?.close(); });

    it("streams the app's runtime log lines to stdout", async () => {
        const platform = await streamingPlatform(["hello from the app", "processing job 1"]);
        server = platform.server;

        const code = await new AppTailCommand(new PlatformClient({ platformUrl: platform.baseUrl })).run("crm");

        expect(code).toBe(0);
        expect(platform.path).toBe("/api/v2/apps/crm/logs");
        expect(stdout.join("")).toContain("hello from the app");
        expect(stdout.join("")).toContain("processing job 1");
    });

});
