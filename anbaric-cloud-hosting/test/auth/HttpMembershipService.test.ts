import {describe, expect, it, vi} from "vitest";
import {HttpMembershipService} from "../../src/auth/HttpMembershipService";

type Recorded = { url : string, init : RequestInit };

const fakeFetch = (status : number, body? : unknown) => {
    const calls : Array<Recorded> = [];
    const fetchFn = vi.fn(async (url : string, init : RequestInit) => {
        calls.push({ url, init });
        return new Response(body === undefined ? null : JSON.stringify(body), {
            status, headers: { "content-type": "application/json" },
        });
    });
    return { fetchFn, calls };
};

const asking = { id: "auth0|new", name: "Dana" };

describe("HttpMembershipService", () => {

    const service = (fetchFn : any, cacheTtlMs : number = 60_000) =>
        new HttpMembershipService("https://central.example/", "central-secret", "dana-x", fetchFn, cacheTtlMs);

    it("asks central for a person's role in this tenant", async () => {
        const { fetchFn, calls } = fakeFetch(200, { role: "BUILDER" });

        expect(await service(fetchFn).roleFor("auth0|guest")).toBe("BUILDER");

        expect(calls[0].url).toBe("https://central.example/tenants/dana-x/members/auth0%7Cguest");
        expect((calls[0].init.headers as Record<string, string>)["x-anbaric-central-key"]).toBe("central-secret");
    });

    it("reports no role for someone central does not know, without throwing", async () => {
        const { fetchFn } = fakeFetch(404, { error: "Not a member of that tenant" });

        expect(await service(fetchFn).roleFor("auth0|stranger")).toBeUndefined();
    });

    it("ignores a role central does not recognise", async () => {
        const { fetchFn } = fakeFetch(200, { role: "SUPERUSER" });

        expect(await service(fetchFn).roleFor("auth0|guest")).toBeUndefined();
    });

    it("caches a role rather than asking on every request, until it expires", async () => {
        const { fetchFn } = fakeFetch(200, { role: "ADMIN" });
        const memberships = service(fetchFn, 0);
        const cached = service(fakeFetch(200, { role: "ADMIN" }).fetchFn);

        await cached.roleFor("ada");
        await cached.roleFor("ada");
        await memberships.roleFor("ada");
        await memberships.roleFor("ada");

        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it("invites through the tenant's invitation endpoint with the central key", async () => {
        const { fetchFn, calls } = fakeFetch(201, { token: "t1", email: "fox@example.com", link: "https://central.example/invitations/t1" });

        const invitation = await service(fetchFn).invite("fox@example.com", "BUILDER", asking);

        expect(calls[0].url).toBe("https://central.example/tenants/dana-x/invitations");
        expect(calls[0].init.method).toBe("POST");
        expect((calls[0].init.headers as Record<string, string>)["x-anbaric-central-key"]).toBe("central-secret");
        expect(JSON.parse(String(calls[0].init.body))).toEqual({ email: "fox@example.com", role: "BUILDER", invitedBy: asking });
        expect(invitation.token).toBe("t1");
    });

    it("names the person asking, so central can check their role", async () => {
        const listed = fakeFetch(200, [{ token: "t1" }]);
        const revoked = fakeFetch(204);

        await service(listed.fetchFn).pending(asking);
        await service(revoked.fetchFn).revoke("t1", asking);

        expect((listed.calls[0].init.headers as Record<string, string>)["x-anbaric-user"]).toBe("auth0|new");
        expect((revoked.calls[0].init.headers as Record<string, string>)["x-anbaric-user"]).toBe("auth0|new");
    });

    it("revokes by token and reports whether anything was there", async () => {
        const gone = fakeFetch(204);
        const missing = fakeFetch(404, { error: "No such invitation" });
        const refused = fakeFetch(403, { error: "Your role in this tenant cannot revoke invitations" });

        expect(await service(gone.fetchFn).revoke("t1", asking)).toBe(true);
        expect(gone.calls[0].url).toBe("https://central.example/tenants/dana-x/invitations/t1");
        expect(await service(missing.fetchFn).revoke("t2", asking)).toBe(false);
        expect(await service(refused.fetchFn).revoke("t3", asking)).toBe(false);
    });

    it("surfaces central's error message on failure", async () => {
        const { fetchFn } = fakeFetch(400, { error: "Expected a body of { email }" });

        await expect(service(fetchFn).invite("bad", "USER", asking)).rejects.toThrow("Expected a body of { email }");
    });

});
