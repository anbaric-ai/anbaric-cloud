import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {generateKeyPairSync} from "node:crypto";
import {createServer, Server} from "node:http";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {AddressInfo} from "node:net";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {CliConfig} from "../src/CliConfig";
import {LogoutCommand} from "../src/commands/LogoutCommand";

const keyPair = generateKeyPairSync("ed25519");

describe("LogoutCommand", () => {

    let configDir : string;
    let server : Server | undefined;
    let received : Array<{ method? : string, url? : string, authorization? : string }>;

    beforeEach(async () => {
        configDir = await mkdtemp(join(tmpdir(), "anbaric-logout-"));
        process.env.ANBARIC_CONFIG_DIR = configDir;
        received = [];
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(async () => {
        delete process.env.ANBARIC_CONFIG_DIR;
        vi.restoreAllMocks();
        if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
        server = undefined;
        await rm(configDir, { recursive: true, force: true });
    });

    const startPlatform = () : Promise<string> =>
        new Promise(resolve => {
            server = createServer((request, response) => {
                received.push({ method: request.method, url: request.url, authorization: request.headers.authorization });
                response.writeHead(204);
                response.end();
            });
            server.listen(0, () => resolve(`http://127.0.0.1:${(server!.address() as AddressInfo).port}`));
        });

    const storeLogin = async (platformUrl : string) => {
        await CliConfig.save({ platformUrl, tenant: "internal" });
        await CliConfig.saveKey({
            platformUrl,
            keyId: "key-1",
            clientName: "chris laptop",
            publicKey: keyPair.publicKey.export({ type: "spki", format: "pem" }).toString(),
            privateKey: keyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
            tenant: "internal",
        });
    };

    it("revokes the key on the platform and removes it locally", async () => {
        const platformUrl = await startPlatform();
        await storeLogin(platformUrl);

        const exitCode = await new LogoutCommand().run();

        expect(exitCode).toBe(0);
        expect(received).toHaveLength(1);
        expect(received[0].method).toBe("DELETE");
        expect(received[0].url).toBe("/api/v2/keys/key-1");
        expect(received[0].authorization).toMatch(/^Bearer /);
        expect(await CliConfig.loadKey()).toBeUndefined();
        expect((await CliConfig.load()).tenant).toBeUndefined();
        expect((await CliConfig.load()).platformUrl).toBe(platformUrl);
    });

    it("still removes the key locally when the platform is unreachable", async () => {
        await storeLogin("http://127.0.0.1:9");

        const exitCode = await new LogoutCommand().run();

        expect(exitCode).toBe(0);
        expect(await CliConfig.loadKey()).toBeUndefined();
    });

    it("does nothing when no key is stored", async () => {
        const exitCode = await new LogoutCommand().run();

        expect(exitCode).toBe(0);
    });

});
