import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {PlatformClient} from "../src/PlatformClient";
import {SecretsCommand} from "../src/commands/SecretsCommand";

type RecordedRequest = { method : string, path : string, app : string | undefined, body : any };

const startStubPlatform = (recorded : Array<RecordedRequest>) : Promise<{ server : Server, baseUrl : string }> =>
    new Promise(resolve => {
        const server = createServer((request, response) => {
            const chunks : Array<Buffer> = [];
            request.on("data", chunk => chunks.push(chunk));
            request.on("end", () => {
                const raw = Buffer.concat(chunks).toString();
                const path = (request.url ?? "").replace(/^\/api\/v2/, "");
                recorded.push({ method: request.method ?? "", path, app: request.headers["x-anbaric-app"] as string | undefined, body: raw ? JSON.parse(raw) : undefined });
                if (request.method === "GET") {
                    response.writeHead(200, { "content-type": "application/json" });
                    response.end(JSON.stringify(["openai-key", "stripe-secret"]));
                    return;
                }
                response.writeHead(204);
                response.end();
            });
        });
        server.listen(0, () => resolve({ server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }));
    });

describe("secrets commands", () => {

    let recorded : Array<RecordedRequest>;
    let platform : Server;
    let client : PlatformClient;

    beforeEach(async () => {
        recorded = [];
        const started = await startStubPlatform(recorded);
        platform = started.server;
        client = new PlatformClient({ platformUrl: started.baseUrl });
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await new Promise<void>(resolve => platform.close(() => resolve()));
    });

    it("lists the app's secret names, scoped by the app header", async () => {
        expect(await new SecretsCommand(client).list("crm")).toBe(0);

        expect(recorded[0]).toMatchObject({ method: "GET", path: "/secrets", app: "crm" });
        expect(console.log).toHaveBeenCalledWith("openai-key");
        expect(console.log).toHaveBeenCalledWith("stripe-secret");
    });

    // The value is asked for, never taken from the command line.
    it("sets a secret with the value it was given privately", async () => {
        const command = new SecretsCommand(client, async () => "sk-live-123");

        expect(await command.set("crm", "openai-key")).toBe(0);

        expect(recorded[0]).toMatchObject({ method: "PUT", path: "/secrets/openai-key", app: "crm", body: { value: "sk-live-123" } });
    });

    it("refuses an empty value, and a name that is not a name", async () => {
        await expect(new SecretsCommand(client, async () => "").set("crm", "openai-key")).rejects.toThrow("No value given");
        await expect(new SecretsCommand(client, async () => "x").set("crm", "bad name!")).rejects.toThrow("not a secret name");
        expect(recorded).toEqual([]);
    });

    it("deletes a secret", async () => {
        expect(await new SecretsCommand(client).delete("crm", "openai-key")).toBe(0);

        expect(recorded[0]).toMatchObject({ method: "DELETE", path: "/secrets/openai-key", app: "crm" });
    });

});
