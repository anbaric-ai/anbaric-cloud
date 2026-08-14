import {afterEach, describe, expect, it} from "vitest";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {KeyRequest} from "../src/KeyRequest";

describe("KeyRequest", () => {

    let server : Server | undefined;

    afterEach(async () => {
        if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
        server = undefined;
    });

    const platformIssuingAfter = (pendingPolls : number) =>
        new Promise<string>(resolve => {
            let polls = 0;
            server = createServer((request, response) => {
                expect(request.url).toBe("/authorize-cli/req-1/poll");
                polls++;
                if (polls <= pendingPolls) {
                    response.writeHead(202, { "content-type": "application/json" });
                    response.end(JSON.stringify({ status: "pending" }));
                    return;
                }
                response.writeHead(200, { "content-type": "application/json" });
                response.end(JSON.stringify({
                    keyId: "key-1",
                    clientName: "chris laptop",
                    publicKey: "PUBLIC-PEM",
                    privateKey: "PRIVATE-PEM",
                }));
            });
            server.listen(0, () => resolve(`http://127.0.0.1:${(server!.address() as AddressInfo).port}`));
        });

    it("polls until the keypair is issued", async () => {
        const platformUrl = await platformIssuingAfter(2);

        const key = await new KeyRequest(platformUrl, "req-1", 10, 5000).awaitKey();

        expect(key).toEqual({
            platformUrl,
            keyId: "key-1",
            clientName: "chris laptop",
            publicKey: "PUBLIC-PEM",
            privateKey: "PRIVATE-PEM",
        });
    });

    it("builds the authorize url from the platform and request id", async () => {
        const request = new KeyRequest("http://platform:8787", "req-9");

        expect(request.authorizeUrl).toBe("http://platform:8787/authorize-cli/req-9");
    });

    it("times out when the browser authorization never happens", async () => {
        const platformUrl = await platformIssuingAfter(1000);

        await expect(new KeyRequest(platformUrl, "req-1", 10, 50).awaitKey())
            .rejects.toThrowError(/Timed out waiting/);
    });

});
