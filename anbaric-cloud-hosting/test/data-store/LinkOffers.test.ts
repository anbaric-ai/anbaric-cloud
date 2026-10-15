import {describe, expect, it, vi} from "vitest";
import {Pool} from "pg";
import {InMemoryEntitlementStore} from "../../src/data-store/InMemoryEntitlementStore";
import {PostgresEntitlementStore} from "../../src/data-store/PostgresEntitlementStore";

const access = { appId: "crm", entitlementId: "access", notes: "" };

describe("entitlements held against an invitation link", () => {

    it("are granted to each person who joins through the link, and kept for the next", async () => {
        const store = new InMemoryEntitlementStore();
        await store.offerForLink("link-1", [access, { appId: null, entitlementId: "reports", notes: "" }], "ada");

        expect(await store.claimLink("link-1", "fox")).toBe(2);
        expect(await store.claimLink("link-1", "owl")).toBe(2);

        expect((await store.listGrants("fox")).map(grant => grant.entitlementId).sort()).toEqual(["access", "reports"]);
        expect((await store.listGrants("owl"))).toHaveLength(2);
    });

    it("grant nothing the second time the same person claims", async () => {
        const store = new InMemoryEntitlementStore();
        await store.offerForLink("link-1", [access], "ada");

        await store.claimLink("link-1", "fox");

        expect(await store.claimLink("link-1", "fox")).toBe(0);
        expect(await store.listGrants("fox")).toHaveLength(1);
    });

    it("are nothing to someone who came in another way", async () => {
        const store = new InMemoryEntitlementStore();
        await store.offerForLink("link-1", [access], "ada");

        expect(await store.claimLink("link-2", "fox")).toBe(0);
        expect(await store.claim("fox@example.com", "fox")).toBe(0);
    });

    it("are written and claimed by the link in Postgres, without the offers being removed", async () => {
        const query = vi.fn(async (_sql : string, _params? : Array<any>) => ({ rows: [{ id: "g1" }], rowCount: 1 }));
        const store = new PostgresEntitlementStore({ query } as unknown as Pool);

        await store.offerForLink("link-1", [access], "ada");
        await store.claimLink("link-1", "fox");

        const offered = String(query.mock.calls[0][0]).replace(/\s+/g, " ");
        expect(offered).toContain("INSERT INTO entitlement_invites (email, link_token");
        expect(query.mock.calls[0][1]).toEqual(["link-1", "crm", "access", "", "ada"]);
        const claimed = String(query.mock.calls[1][0]).replace(/\s+/g, " ");
        expect(claimed).toContain("INSERT INTO entitlement_grants");
        expect(claimed).toContain("WHERE offered.link_token = $1");
        expect(claimed).not.toContain("DELETE");
        expect(query.mock.calls[1][1]).toEqual(["link-1", "fox"]);
    });

});
