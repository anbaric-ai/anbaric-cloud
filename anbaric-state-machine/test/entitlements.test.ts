import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Entitlements, ResolvedSession, SessionResolver} from "anbaric-tsapi";
import {hasEntitlement, registerEntitlement} from "../src/entitlements/entitlements.js";

const stubResolver = (session? : ResolvedSession) : SessionResolver => ({
    resolve: vi.fn(async (_token : string) => session),
});

const stubEntitlements = (answer : boolean) => ({
    register: vi.fn(async (_appId : string, _entitlementId : string, _notes? : string) => {}),
    has: vi.fn(async (_appId : string, _userId : string, _entitlementId : string) => answer),
}) satisfies Entitlements;

describe("entitlements facade", () => {

    const ada : ResolvedSession = { id: "ada", roles: ["admin"] };

    beforeEach(() => { process.env.ANBARIC_APP_ID = "crm"; });

    afterEach(() => { delete process.env.ANBARIC_APP_ID; });

    it("registers against the current app", async () => {
        const entitlements = stubEntitlements(true);

        await registerEntitlement("export", "Can export reports", entitlements);

        expect(entitlements.register).toHaveBeenCalledWith("crm", "export", "Can export reports");
    });

    it("checks the resolved user against the current app from a session token", async () => {
        const entitlements = stubEntitlements(true);

        expect(await hasEntitlement("token-1", "export", stubResolver(ada), entitlements)).toBe(true);

        expect(entitlements.has).toHaveBeenCalledWith("crm", "ada", "export");
    });

    it("reads the session cookie from an incoming request", async () => {
        const entitlements = stubEntitlements(false);
        const resolver = stubResolver(ada);
        const request = { headers: { cookie: "a=1; anbaric_session=token-1" } } as any;

        expect(await hasEntitlement(request, "export", resolver, entitlements)).toBe(false);

        expect(resolver.resolve).toHaveBeenCalledWith("token-1");
        expect(entitlements.has).toHaveBeenCalledWith("crm", "ada", "export");
    });

    it("is not entitled when there is no session to resolve", async () => {
        const entitlements = stubEntitlements(true);

        expect(await hasEntitlement({ headers: {} } as any, "export", stubResolver(ada), entitlements)).toBe(false);
        expect(await hasEntitlement("bad-token", "export", stubResolver(undefined), entitlements)).toBe(false);

        expect(entitlements.has).not.toHaveBeenCalled();
    });

});
