import {beforeAll, describe, expect, it} from "vitest";
import {JWTVerifyGetKey, SignJWT, exportJWK, generateKeyPair} from "jose";
import {Role} from "anbaric-cloud-hosting";
import {Auth0Authenticator} from "../src/Auth0Authenticator";

const DOMAIN = "anbaric-test.eu.auth0.com";
const AUDIENCE = "https://api.anbaric.test";
const ISSUER = `https://${DOMAIN}/`;

describe("Auth0Authenticator", () => {

    let privateKey : CryptoKey;
    let getKey : JWTVerifyGetKey;

    beforeAll(async () => {
        const keys = await generateKeyPair("RS256");
        privateKey = keys.privateKey as CryptoKey;
        const publicKey = keys.publicKey;
        getKey = async () => publicKey as CryptoKey;
    });

    const tokenWith = (claims : Record<string, unknown>, overrides : { issuer? : string, audience? : string, expiresAt? : number } = {}) => {
        const jwt = new SignJWT(claims)
            .setProtectedHeader({ alg: "RS256" })
            .setSubject("auth0|user-1")
            .setIssuer(overrides.issuer ?? ISSUER)
            .setAudience(overrides.audience ?? AUDIENCE)
            .setIssuedAt();
        return jwt.setExpirationTime(overrides.expiresAt ?? "5m").sign(privateKey);
    };

    const authenticator = () => new Auth0Authenticator({ domain: DOMAIN, audience: AUDIENCE }, (...args) => getKey(...args));

    it("authenticates a valid token into a user with its roles", async () => {
        const token = await tokenWith({ "https://anbaric.ai/roles": ["admin", "operator"] });

        const user = await authenticator().authenticate(token);

        expect(user.id).toBe("auth0|user-1");
        expect(user.roles.map(role => role.id)).toEqual(["admin", "operator"]);
        expect(user.hasRole(new Role("admin"))).toBe(true);
    });

    it("reads roles from a custom claim when configured", async () => {
        const custom = new Auth0Authenticator(
            { domain: DOMAIN, audience: AUDIENCE, rolesClaim: "https://example.com/roles" },
            (...args) => getKey(...args));
        const token = await tokenWith({ "https://example.com/roles": ["viewer"] });

        expect((await custom.authenticate(token)).roles.map(role => role.id)).toEqual(["viewer"]);
    });

    it("authenticates a token without a roles claim into a role-less user", async () => {
        const user = await authenticator().authenticate(await tokenWith({}));

        expect(user.roles).toEqual([]);
    });

    it("rejects a token for a different audience", async () => {
        const token = await tokenWith({}, { audience: "https://other.api" });

        await expect(authenticator().authenticate(token)).rejects.toThrowError("Not authenticated");
    });

    it("rejects a token from a different issuer", async () => {
        const token = await tokenWith({}, { issuer: "https://evil.example/" });

        await expect(authenticator().authenticate(token)).rejects.toThrowError("Not authenticated");
    });

    it("rejects an expired token", async () => {
        const token = await tokenWith({}, { expiresAt: Math.floor(Date.now() / 1000) - 60 });

        await expect(authenticator().authenticate(token)).rejects.toThrowError("Not authenticated");
    });

    it("rejects garbage", async () => {
        await expect(authenticator().authenticate("not-a-jwt")).rejects.toThrowError("Not authenticated");
    });

});
