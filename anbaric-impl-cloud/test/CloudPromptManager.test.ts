import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {CloudPromptManager} from "../src/CloudPromptManager.js";

type Received = { method? : string, url? : string, app? : string, body? : any };

describe("CloudPromptManager", () => {

    let server : Server;

    beforeEach(() => { process.env.ANBARIC_APP_ID = "crm"; });

    afterEach(() => new Promise<void>(resolve => {
        delete process.env.ANBARIC_APP_ID;
        server.close(() => resolve());
    }));

    const start = (reply : unknown, received : Received) : Promise<string> =>
        new Promise(resolve => {
            server = createServer((request, response) => {
                const chunks : Array<Buffer> = [];
                request.on("data", chunk => chunks.push(chunk));
                request.on("end", () => {
                    const raw = Buffer.concat(chunks).toString();
                    Object.assign(received, {
                        method: request.method, url: request.url, app: request.headers["x-anbaric-app"],
                        body: raw ? JSON.parse(raw) : undefined,
                    });
                    response.writeHead(200, { "content-type": "application/json" });
                    response.end(JSON.stringify(reply));
                });
            });
            server.listen(0, () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
        });

    const prompt = { appId: "crm", promptId: "triage", version: 1, instructions: "Decide.", createdAt: "2026-09-22T10:00:00.000Z" };

    it("saves with a PUT on the prompt, carrying the app header", async () => {
        const received : Received = {};
        const prompts = new CloudPromptManager(await start(prompt, received));

        const saved = await prompts.save("triage", "Decide.", { type: "object" });

        expect(received).toEqual({
            method: "PUT", url: "/api/v2/prompts/triage", app: "crm", body: { instructions: "Decide.", outputSchema: { type: "object" } },
        });
        expect(saved).toEqual(prompt);
    });

    it("retrieves the latest, or a named version as a query parameter", async () => {
        const latest : Received = {};
        const prompts = new CloudPromptManager(await start(prompt, latest));
        await prompts.retrieve("triage");
        expect(latest.url).toBe("/api/v2/prompts/triage");
        await new Promise<void>(resolve => server.close(() => resolve()));

        const named : Received = {};
        await new CloudPromptManager(await start(prompt, named)).retrieve("triage", 3);
        expect(named.url).toBe("/api/v2/prompts/triage?version=3");
    });

    it("lists prompts and reads a prompt's history", async () => {
        const listed : Received = {};
        expect(await new CloudPromptManager(await start([prompt], listed)).list()).toEqual([prompt]);
        expect(listed.url).toBe("/api/v2/prompts");
        await new Promise<void>(resolve => server.close(() => resolve()));

        const history : Received = {};
        expect(await new CloudPromptManager(await start([prompt], history)).history("triage")).toEqual([prompt]);
        expect(history.url).toBe("/api/v2/prompts/triage/history");
    });

});
