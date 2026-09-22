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

describe("HttpMembershipService", () => {

    const service = (fetchFn : any) => new HttpMembershipService("https://central.example/", "central-secret", "dana-x", fetchFn);

    it("invites through the tenant's invitation endpoint with the central key", async () => {
        const { fetchFn, calls } = fakeFetch(201, { token: "t1", email: "fox@example.com", link: "https://central.example/invitations/t1" });

        const invitation = await service(fetchFn).invite("fox@example.com", { id: "auth0|new", name: "Dana" });

        expect(calls[0].url).toBe("https://central.example/tenants/dana-x/invitations");
        expect(calls[0].init.method).toBe("POST");
        expect((calls[0].init.headers as Record<string, string>)["x-anbaric-central-key"]).toBe("central-secret");
        expect(JSON.parse(String(calls[0].init.body))).toEqual({ email: "fox@example.com", invitedBy: { id: "auth0|new", name: "Dana" } });
        expect(invitation.token).toBe("t1");
    });

    it("lists pending invitations", async () => {
        const { fetchFn, calls } = fakeFetch(200, [{ token: "t1" }]);

        const pending = await service(fetchFn).pending();

        expect(calls[0].init.method).toBe("GET");
        expect(pending).toEqual([{ token: "t1" }]);
    });

    it("revokes by token and reports whether anything was there", async () => {
        const gone = fakeFetch(204);
        const missing = fakeFetch(404, { error: "No such invitation" });

        expect(await service(gone.fetchFn).revoke("t1")).toBe(true);
        expect(gone.calls[0].url).toBe("https://central.example/tenants/dana-x/invitations/t1");
        expect(await service(missing.fetchFn).revoke("t2")).toBe(false);
    });

    it("surfaces central's error message on failure", async () => {
        const { fetchFn } = fakeFetch(400, { error: "Expected a body of { email }" });

        await expect(service(fetchFn).invite("bad", { id: "x" })).rejects.toThrow("Expected a body of { email }");
    });

});
