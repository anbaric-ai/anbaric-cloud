import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {CloudEntitlements} from "../src/CloudEntitlements.js";

type Received = { method? : string, url? : string, app? : string, body? : any };

describe("CloudEntitlements", () => {

    let server : Server;

    beforeEach(() => { process.env.ANBARIC_APP_ID = "crm"; });

    afterEach(() => new Promise<void>(resolve => {
        delete process.env.ANBARIC_APP_ID;
        server.close(() => resolve());
    }));

    const start = (status : number, reply : unknown, received : Received) : Promise<string> =>
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
                    response.writeHead(status, { "content-type": "application/json" });
                    response.end(reply === undefined ? undefined : JSON.stringify(reply));
                });
            });
            server.listen(0, () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
        });

    it("registers with a POST carrying the app header", async () => {
        const received : Received = {};
        const entitlements = new CloudEntitlements(await start(204, undefined, received));

        await entitlements.register("crm", "export", "Can export");

        expect(received).toEqual({
            method: "POST", url: "/api/v2/entitlements", app: "crm", body: { entitlementId: "export", notes: "Can export" },
        });
    });

    it("checks with a GET on the entitlement's check subresource", async () => {
        const received : Received = {};
        const entitlements = new CloudEntitlements(await start(200, { has: true }, received));

        expect(await entitlements.has("crm", "ada lovelace", "export")).toBe(true);

        expect(received.method).toBe("GET");
        expect(received.url).toBe("/api/v2/entitlements/export/check?userId=ada%20lovelace");
        expect(received.app).toBe("crm");
    });

    it("reports the current app id", () => {
        expect(new CloudEntitlements("http://unused").getAppId()).toBe("crm");
    });

});
