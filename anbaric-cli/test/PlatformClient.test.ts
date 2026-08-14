import {afterEach, describe, expect, it} from "vitest";
import {generateKeyPairSync} from "node:crypto";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {StoredKey} from "../src/CliConfig";
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

    const keyPair = generateKeyPairSync("ed25519");

    const storedKeyFor = (platformUrl : string) : StoredKey => ({
        platformUrl,
        keyId: "key-1",
        clientName: "chris laptop",
        publicKey: keyPair.publicKey.export({ type: "spki", format: "pem" }).toString(),
        privateKey: keyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    });

    const headerRecordingPlatform = (received : Array<string | undefined>) =>
        new Promise<string>(resolve => {
            server = createServer((request, response) => {
                received.push(request.headers.authorization);
                response.writeHead(200, { "content-type": "application/json" });
                response.end("{}");
            });
            server.listen(0, () => resolve(`http://127.0.0.1:${(server!.address() as AddressInfo).port}`));
        });

    it("signs every request with a bearer token when a key is configured", async () => {
        const received : Array<string | undefined> = [];
        const platformUrl = await headerRecordingPlatform(received);

        await new PlatformClient({ platformUrl, key: storedKeyFor(platformUrl) }).get("/jobs");

        expect(received[0]).toMatch(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    });

    it("sends no authorization header without a key", async () => {
        const received : Array<string | undefined> = [];
        const platformUrl = await headerRecordingPlatform(received);

        await new PlatformClient({ platformUrl }).get("/jobs");

        expect(received[0]).toBeUndefined();
    });

    it("keeps ordinary error messages intact", async () => {
        const client = await clientAgainst(404, {}, JSON.stringify({ error: 'No job found with id "x"' }));

        await expect(client.get("/jobs/x")).rejects.toThrowError('No job found with id "x"');
    });

});
