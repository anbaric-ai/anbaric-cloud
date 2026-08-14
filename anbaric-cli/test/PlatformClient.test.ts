import {afterEach, describe, expect, it} from "vitest";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {PlatformClient} from "../src/PlatformClient";

describe("PlatformClient", () => {

    let server : Server | undefined;

    afterEach(async () => {
        if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
        server = undefined;
    });

    const clientAgainst = (status : number, headers : Record<string, string> = {}, body? : string) =>
        new Promise<PlatformClient>(resolve => {
            server = createServer((_request, response) => {
                response.writeHead(status, { "content-type": "application/json", ...headers });
                response.end(body ?? "{}");
            });
            server.listen(0, () => resolve(new PlatformClient({
                platformUrl: `http://127.0.0.1:${(server!.address() as AddressInfo).port}`,
            })));
        });

    it("turns a login redirect into an instruction to run anbaric login", async () => {
        const client = await clientAgainst(302, { location: "https://tenant.auth0.com/authorize" });

        await expect(client.get("/jobs")).rejects.toThrowError(/run `anbaric login`/);
    });

    it("turns a 401 into an instruction to run anbaric login", async () => {
        const client = await clientAgainst(401);

        await expect(client.get("/jobs")).rejects.toThrowError(/not signed in/);
    });

    it("passes ordinary responses through", async () => {
        const client = await clientAgainst(200, {}, JSON.stringify({ ok: true }));

        expect(await client.get("/jobs")).toEqual({ ok: true });
    });

    it("keeps ordinary error messages intact", async () => {
        const client = await clientAgainst(404, {}, JSON.stringify({ error: 'No job found with id "x"' }));

        await expect(client.get("/jobs/x")).rejects.toThrowError('No job found with id "x"');
    });

});
