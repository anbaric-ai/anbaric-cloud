import {generateKeyPairSync, sign} from "node:crypto";
import {IncomingMessage, ServerResponse} from "node:http";
import {describe, expect, it} from "vitest";
import {CliKey} from "../../src/auth/CliKey";
import {InMemoryCliKeyStore} from "../../src/auth/InMemoryCliKeyStore";
import {TokenAuthenticator} from "../../src/auth/TokenAuthenticator";

const keyPair = generateKeyPairSync("ed25519");
const otherKeyPair = generateKeyPairSync("ed25519");
const publicKeyPem = keyPair.publicKey.export({ type: "spki", format: "pem" }).toString();

const encoded = (claims : unknown) => Buffer.from(JSON.stringify(claims)).toString("base64url");

const token = (kid : string, expiresInSeconds : number = 60, privateKey = keyPair.privateKey) => {
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = encoded({ alg: "EdDSA", typ: "JWT", kid });
    const payload = encoded({ iat: issuedAt, exp: issuedAt + expiresInSeconds });
    const signature = sign(null, Buffer.from(`${header}.${payload}`), privateKey).toString("base64url");
    return `${header}.${payload}.${signature}`;
};

const authenticatorWithKey = async () => {
    const store = new InMemoryCliKeyStore();
    await store.save(new CliKey("key-1", "user-1", "chris laptop", publicKeyPem));
    return new TokenAuthenticator(store);
};

const request = (authorization? : string) =>
    ({ headers: authorization ? { authorization } : {} }) as IncomingMessage;

const recordingResponse = () => {
    const written : { status? : number, body? : string } = {};
    const response = {
        writeHead(status : number) { written.status = status; return response; },
        end(body? : string) { written.body = body; },
    } as unknown as ServerResponse;
    return { response, written };
};

describe("TokenAuthenticator", () => {

    it("handles requests carrying a bearer token", async () => {
        const authenticator = await authenticatorWithKey();

        expect(authenticator.handles(request("Bearer abc"))).toBe(true);
        expect(authenticator.handles(request("Basic abc"))).toBe(false);
        expect(authenticator.handles(request())).toBe(false);
    });

    it("authenticates a valid token as the key's user", async () => {
        const authenticator = await authenticatorWithKey();
        const { response, written } = recordingResponse();

        const user = await authenticator.authenticate(request(`Bearer ${token("key-1")}`), response);

        expect(user?.id).toBe("user-1");
        expect(written.status).toBeUndefined();
    });

    it("rejects an expired token with a 401", async () => {
        const authenticator = await authenticatorWithKey();
        const { response, written } = recordingResponse();

        const user = await authenticator.authenticate(request(`Bearer ${token("key-1", -10)}`), response);

        expect(user).toBeUndefined();
        expect(written.status).toBe(401);
        expect(written.body).toContain("anbaric login");
    });

    it("rejects a token for an unknown key id", async () => {
        const authenticator = await authenticatorWithKey();
        const { response, written } = recordingResponse();

        const user = await authenticator.authenticate(request(`Bearer ${token("key-9")}`), response);

        expect(user).toBeUndefined();
        expect(written.status).toBe(401);
    });

    it("rejects a token signed with the wrong private key", async () => {
        const authenticator = await authenticatorWithKey();
        const { response, written } = recordingResponse();

        const forged = token("key-1", 60, otherKeyPair.privateKey);
        const user = await authenticator.authenticate(request(`Bearer ${forged}`), response);

        expect(user).toBeUndefined();
        expect(written.status).toBe(401);
    });

    it("rejects garbage that is not a jwt", async () => {
        const authenticator = await authenticatorWithKey();
        const { response, written } = recordingResponse();

        const user = await authenticator.authenticate(request("Bearer not-a-token"), response);

        expect(user).toBeUndefined();
        expect(written.status).toBe(401);
    });

});
