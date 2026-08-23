import {describe, expect, it} from "vitest";
import {ResolvedSession, SessionResolver} from "anbaric-tsapi";
import {Human} from "../src/actors/Human";

const stubResolver = (session? : ResolvedSession) : SessionResolver => ({
    resolve: async (_token : string) => session,
});

describe("Human.fromSession", () => {

    const resolved : ResolvedSession = { id: "ada", roles: ["admin", "reviewer"], tenant: "acme" };

    it("builds a HUMAN actor from a session token", async () => {
        const human = await Human.fromSession("token-1", stubResolver(resolved));

        expect(human.type).toBe("HUMAN");
        expect(human.id).toBe("ada");
        expect(human.roles).toEqual(["admin", "reviewer"]);
    });

    it("reads the anbaric_session cookie from an incoming request", async () => {
        const request = { headers: { cookie: "a=1; anbaric_session=token-1; b=2" } } as any;

        const human = await Human.fromSession(request, stubResolver(resolved));

        expect(human.id).toBe("ada");
    });

    it("throws when the session cannot be resolved", async () => {
        await expect(Human.fromSession("bad", stubResolver(undefined))).rejects.toThrowError(/Could not resolve the session/);
    });

    it("throws when the request carries no session cookie", async () => {
        const request = { headers: {} } as any;

        await expect(Human.fromSession(request, stubResolver(resolved))).rejects.toThrowError(/Could not resolve the session/);
    });

});
