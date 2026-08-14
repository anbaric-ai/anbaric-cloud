import {beforeAll, describe, expect, it} from "vitest";
import {IncomingMessage, ServerResponse} from "node:http";
import {JWTVerifyGetKey, SignJWT, generateKeyPair} from "jose";
import {Role} from "anbaric-cloud-hosting";
import {Auth0Authenticator} from "../src/Auth0Authenticator";

const DOMAIN = "anbaric-test.eu.auth0.com";
const CLIENT_ID = "client-1";
const PUBLIC_URL = "http://localhost:8787";
const ISSUER = `https://${DOMAIN}/`;

const fakeRequest = (url : string) => ({ url }) as IncomingMessage;

class FakeResponse {

    status? : number;
    headers : Record<string, any> = {};
    body? : string;
    ended = false;

    writeHead(status : number, headers? : Record<string, any>) {
        this.status = status;
        Object.assign(this.headers, headers ?? {});
        return this;
    }

    end(body? : string) {
        this.body = body;
        this.ended = true;
    }

}

const asServerResponse = (response : FakeResponse) => response as unknown as ServerResponse;

describe("Auth0Authenticator", () => {

    let privateKey : CryptoKey;
    let getKey : JWTVerifyGetKey;

    beforeAll(async () => {
        const keys = await generateKeyPair("RS256");
        privateKey = keys.privateKey as CryptoKey;
        const publicKey = keys.publicKey;
        getKey = async () => publicKey as CryptoKey;
    });

    const idTokenWith = (claims : Record<string, unknown> = {}, overrides : { audience? : string, expiresAt? : number } = {}) =>
        new SignJWT(claims)
            .setProtectedHeader({ alg: "RS256" })
            .setSubject("auth0|user-1")
            .setIssuer(ISSUER)
            .setAudience(overrides.audience ?? CLIENT_ID)
            .setIssuedAt()
            .setExpirationTime(overrides.expiresAt ?? "1h")
            .sign(privateKey);

    const authenticator = (exchangeCode? : (code : string) => Promise<string>) =>
        new Auth0Authenticator(
            { domain: DOMAIN, clientId: CLIENT_ID, clientSecret: "shhh", publicUrl: PUBLIC_URL },
            (...args) => getKey(...args),
            exchangeCode,
        );

    it("authenticates a valid session into a user with its roles", async () => {
        const session = await idTokenWith({ "https://anbaric.ai/roles": ["admin"] });
        const response = new FakeResponse();

        const user = await authenticator().authenticate(session, fakeRequest("/jobs"), asServerResponse(response));

        expect(user?.id).toBe("auth0|user-1");
        expect(user?.hasRole(new Role("admin"))).toBe(true);
        expect(response.ended).toBe(false);
    });

    it("redirects to the tenant's login when there is no session", async () => {
        const response = new FakeResponse();

        const user = await authenticator().authenticate(undefined, fakeRequest("/jobs?page=2"), asServerResponse(response));

        expect(user).toBeUndefined();
        expect(response.status).toBe(302);
        const location = new URL(response.headers.location);
        expect(location.origin).toBe(`https://${DOMAIN}`);
        expect(location.pathname).toBe("/authorize");
        expect(location.searchParams.get("client_id")).toBe(CLIENT_ID);
        expect(location.searchParams.get("redirect_uri")).toBe(`${PUBLIC_URL}/callback`);
        expect(location.searchParams.get("state")).toBe("/jobs?page=2");
    });

    it("redirects to login when the session token is invalid", async () => {
        const session = await idTokenWith({}, { audience: "someone-else" });
        const response = new FakeResponse();

        const user = await authenticator().authenticate(session, fakeRequest("/jobs"), asServerResponse(response));

        expect(user).toBeUndefined();
        expect(response.status).toBe(302);
    });

    it("redirects to login when the session token has expired", async () => {
        const session = await idTokenWith({}, { expiresAt: Math.floor(Date.now() / 1000) - 60 });
        const response = new FakeResponse();

        await authenticator().authenticate(session, fakeRequest("/jobs"), asServerResponse(response));

        expect(response.status).toBe(302);
    });

    it("completes the login callback by setting the session cookie and returning to the requested page", async () => {
        const idToken = await idTokenWith();
        const response = new FakeResponse();

        const user = await authenticator(async code => {
            expect(code).toBe("auth-code-1");
            return idToken;
        }).authenticate(undefined, fakeRequest("/callback?code=auth-code-1&state=%2Fjobs%3Fpage%3D2"), asServerResponse(response));

        expect(user).toBeUndefined();
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/jobs?page=2");
        expect(response.headers["set-cookie"]).toContain(`anbaric_session=${idToken}`);
        expect(response.headers["set-cookie"]).toContain("HttpOnly");
    });

    it("never redirects the callback outside the platform", async () => {
        const idToken = await idTokenWith();
        const response = new FakeResponse();

        await authenticator(async () => idToken)
            .authenticate(undefined, fakeRequest("/callback?code=c&state=https%3A%2F%2Fevil.example"), asServerResponse(response));

        expect(response.headers.location).toBe("/");
    });

    it("rejects a callback without a code", async () => {
        const response = new FakeResponse();

        await authenticator().authenticate(undefined, fakeRequest("/callback"), asServerResponse(response));

        expect(response.status).toBe(401);
    });

    it("rejects a callback whose code exchange fails", async () => {
        const response = new FakeResponse();

        await authenticator(async () => {
            throw new Error("exchange failed");
        }).authenticate(undefined, fakeRequest("/callback?code=bad"), asServerResponse(response));

        expect(response.status).toBe(401);
    });

    it("rejects a callback whose id token fails verification", async () => {
        const forged = await idTokenWith({}, { audience: "someone-else" });
        const response = new FakeResponse();

        await authenticator(async () => forged)
            .authenticate(undefined, fakeRequest("/callback?code=c"), asServerResponse(response));

        expect(response.status).toBe(401);
    });

});
