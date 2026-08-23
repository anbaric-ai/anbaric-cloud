import {describe, expect, it, vi} from "vitest";
import {Authenticator} from "../../src/auth/Authenticator";
import {SessionSigner} from "../../src/auth/SessionSigner";
import {Tenant} from "../../src/auth/Tenant";
import {User} from "../../src/auth/User";
import {AuthenticationMiddleware} from "../../src/hosting/middleware/AuthenticationMiddleware";
import {Request} from "../../src/hosting/Request";

const fakeRequest = (session? : string) => {
    const headers : Record<string, any> = {};
    return {
        session,
        raw: { headers: {}, method: "GET" },
        rawResponse: { getHeader: (name : string) => headers[name], setHeader: (name : string, value : any) => { headers[name] = value; } },
        handled: false,
        user: undefined,
        tenant: undefined,
        setCookie: () => String(headers["Set-Cookie"] ?? ""),
    } as unknown as Request & { setCookie : () => string };
};

const spyAuthenticator = (result? : [User, Tenant]) => ({
    authenticate: vi.fn(async () => result),
    authorize: vi.fn(async () => true),
}) as unknown as Authenticator & { authenticate : ReturnType<typeof vi.fn>, authorize : ReturnType<typeof vi.fn> };

describe("AuthenticationMiddleware platform sessions", () => {

    const signer = new SessionSigner("test-secret");

    it("authenticates a valid session cookie without calling the authenticator", async () => {
        const authenticator = spyAuthenticator();
        const middleware = new AuthenticationMiddleware(authenticator, undefined, () => false, signer);
        const request = fakeRequest(signer.mint(new User("ada"), new Tenant("acme")));

        expect(await middleware.apply(request)).toBe(true);
        expect(request.user?.id).toBe("ada");
        expect(request.tenant?.id).toBe("acme");
        expect(authenticator.authenticate).not.toHaveBeenCalled();
        expect(request.setCookie()).toContain("anbaric_session=");
    });

    it("falls through to the authenticator and mints a session on fresh login", async () => {
        const authenticator = spyAuthenticator([new User("grace"), new Tenant("acme")]);
        const middleware = new AuthenticationMiddleware(authenticator, undefined, () => false, signer);
        const request = fakeRequest(undefined);

        expect(await middleware.apply(request)).toBe(true);
        expect(authenticator.authenticate).toHaveBeenCalledOnce();
        expect(request.user?.id).toBe("grace");
        expect(request.setCookie()).toContain("anbaric_session=");
    });

    it("ignores the session cookie when no signing secret is set", async () => {
        const authenticator = spyAuthenticator([new User("grace"), new Tenant("acme")]);
        const middleware = new AuthenticationMiddleware(authenticator, undefined, () => false, new SessionSigner(""));
        const request = fakeRequest("anything");

        await middleware.apply(request);

        expect(authenticator.authenticate).toHaveBeenCalledOnce();
    });

});
