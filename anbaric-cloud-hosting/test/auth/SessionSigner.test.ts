import {describe, expect, it} from "vitest";
import {Role} from "../../src/auth/Role";
import {SessionSigner} from "../../src/auth/SessionSigner";
import {Tenant} from "../../src/auth/Tenant";
import {User} from "../../src/auth/User";

const cookieResponse = () => {
    const headers : Record<string, any> = {};
    return {
        response: { getHeader: (name : string) => headers[name], setHeader: (name : string, value : any) => { headers[name] = value; } } as any,
        cookie: () => String(headers["Set-Cookie"]),
    };
};

describe("SessionSigner", () => {

    const signer = new SessionSigner("test-secret");

    it("is inert without a secret", () => {
        const unset = new SessionSigner("");
        expect(unset.configured).toBe(false);
        expect(unset.verify("anything")).toBeUndefined();
    });

    it("mints and verifies a session carrying the user, roles and tenant", () => {
        const result = signer.verify(signer.mint(new User("ada", [new Role("admin")]), new Tenant("acme")));

        expect(result).toBeDefined();
        const [user, tenant] = result!;
        expect(user.id).toBe("ada");
        expect(user.hasRole(new Role("admin"))).toBe(true);
        expect(tenant?.id).toBe("acme");
    });

    it("rejects a tampered payload or signature", () => {
        const [payload, signature] = signer.mint(new User("ada")).split(".");
        const forged = Buffer.from(JSON.stringify({ sub: "mallory", roles: [], exp: 9_999_999_999 })).toString("base64url");

        expect(signer.verify(`${forged}.${signature}`)).toBeUndefined();
        expect(signer.verify(`${payload}.deadbeef`)).toBeUndefined();
    });

    it("rejects a token signed with a different secret", () => {
        expect(signer.verify(new SessionSigner("other-secret").mint(new User("ada")))).toBeUndefined();
    });

    it("rejects an expired session", () => {
        const expired = new SessionSigner("test-secret", -1);
        expect(expired.verify(expired.mint(new User("ada")))).toBeUndefined();
    });

    it("issues a hardened session cookie", () => {
        const { response, cookie } = cookieResponse();

        signer.issue(response, new User("ada"), new Tenant("acme"));

        expect(cookie()).toContain("anbaric_session=");
        expect(cookie()).toContain("HttpOnly");
        expect(cookie()).toContain("Secure");
        expect(cookie()).toContain("SameSite=Lax");
        expect(cookie()).not.toContain("Domain=");
    });

    it("scopes the cookie to the configured domain, when issuing and when clearing", () => {
        const scoped = new SessionSigner("test-secret", 60, "staging.example");
        const issued = cookieResponse();
        const cleared = cookieResponse();

        scoped.issue(issued.response, new User("ada"));
        scoped.clear(cleared.response);

        expect(issued.cookie()).toContain("; Domain=staging.example");
        expect(cleared.cookie()).toContain("; Domain=staging.example");
        expect(cleared.cookie()).toContain("Max-Age=0");
    });

    it("uses the configured ttl for the cookie lifetime", () => {
        const { response, cookie } = cookieResponse();

        new SessionSigner("test-secret", 3600).issue(response, new User("ada"));

        expect(cookie()).toContain("Max-Age=3600");
    });

    it("reads the ttl from ANBARIC_SESSION_TTL_SECONDS", () => {
        const previous = process.env.ANBARIC_SESSION_TTL_SECONDS;
        process.env.ANBARIC_SESSION_TTL_SECONDS = "120";
        try {
            const { response, cookie } = cookieResponse();
            new SessionSigner("test-secret").issue(response, new User("ada"));
            expect(cookie()).toContain("Max-Age=120");
        } finally {
            if (previous === undefined) delete process.env.ANBARIC_SESSION_TTL_SECONDS;
            else process.env.ANBARIC_SESSION_TTL_SECONDS = previous;
        }
    });

});
