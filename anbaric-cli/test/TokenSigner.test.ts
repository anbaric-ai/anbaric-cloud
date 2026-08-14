import {createPublicKey, generateKeyPairSync, verify} from "node:crypto";
import {describe, expect, it} from "vitest";
import {StoredKey} from "../src/CliConfig";
import {TokenSigner} from "../src/TokenSigner";

const keyPair = generateKeyPairSync("ed25519");
const otherKeyPair = generateKeyPairSync("ed25519");

const storedKey : StoredKey = {
    platformUrl: "http://localhost:8787",
    keyId: "key-1",
    clientName: "chris laptop",
    publicKey: keyPair.publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKey: keyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};

const decoded = (part : string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

describe("TokenSigner", () => {

    it("mints a jwt carrying the key id and a short expiry", () => {
        const now = new Date("2026-08-14T12:00:00Z");

        const [header, payload] = new TokenSigner(storedKey).sign(now).split(".");

        expect(decoded(header)).toEqual({ alg: "EdDSA", typ: "JWT", kid: "key-1" });
        expect(decoded(payload)).toEqual({ iat: 1786708800, exp: 1786708860 });
    });

    it("signs so the stored public key verifies the token", () => {
        const [header, payload, signature] = new TokenSigner(storedKey).sign().split(".");

        const valid = verify(null, Buffer.from(`${header}.${payload}`),
            createPublicKey(storedKey.publicKey), Buffer.from(signature, "base64url"));

        expect(valid).toBe(true);
    });

    it("produces signatures another key rejects", () => {
        const [header, payload, signature] = new TokenSigner(storedKey).sign().split(".");

        const valid = verify(null, Buffer.from(`${header}.${payload}`),
            otherKeyPair.publicKey, Buffer.from(signature, "base64url"));

        expect(valid).toBe(false);
    });

});
