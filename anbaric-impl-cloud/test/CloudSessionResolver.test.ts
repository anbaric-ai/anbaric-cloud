import {afterEach, describe, expect, it} from "vitest";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {CloudApiClient} from "../src/CloudApiClient.js";
import {CloudSessionResolver} from "../src/CloudSessionResolver.js";

describe("CloudSessionResolver", () => {

    let server : Server;

    afterEach(() => new Promise<void>(resolve => server.close(() => resolve())));

    const start = (handler : (request : any, response : any, body : string) => void) : Promise<string> =>
        new Promise(resolve => {
            server = createServer((request, response) => {
                const chunks : Array<Buffer> = [];
                request.on("data", chunk => chunks.push(chunk));
                request.on("end", () => handler(request, response, Buffer.concat(chunks).toString()));
            });
            server.listen(0, () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
        });

    it("resolves a session via POST /api/v2/sessions/resolve", async () => {
        let received : { url? : string, body : any } | undefined;
        const baseUrl = await start((request, response, body) => {
            received = { url: request.url, body: JSON.parse(body) };
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify({ id: "ada", roles: ["admin"], tenant: "acme" }));
        });

        const session = await new CloudSessionResolver(new CloudApiClient(baseUrl)).resolve("tok");

        expect(received?.url).toBe("/api/v2/sessions/resolve");
        expect(received?.body).toEqual({ session: "tok" });
        expect(session).toEqual({ id: "ada", roles: ["admin"], tenant: "acme" });
    });

    it("returns undefined when the platform rejects the token", async () => {
        const baseUrl = await start((_request, response) => {
            response.writeHead(401, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: "Invalid or expired session" }));
        });

        expect(await new CloudSessionResolver(new CloudApiClient(baseUrl)).resolve("bad")).toBeUndefined();
    });

});
