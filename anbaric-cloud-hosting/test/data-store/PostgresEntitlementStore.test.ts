import {describe, expect, it, vi} from "vitest";
import {Pool} from "pg";
import {PostgresEntitlementStore} from "../../src/data-store/PostgresEntitlementStore";

const mockPool = (rows : Array<any> = [], rowCount = rows.length) => {
    const query = vi.fn(async (_sql : string, _params? : Array<any>) => ({ rows, rowCount }));
    return { pool: { query } as unknown as Pool, query };
};

const sqlOf = (query : ReturnType<typeof mockPool>["query"]) => String(query.mock.calls[0][0]).replace(/\s+/g, " ");
const paramsOf = (query : ReturnType<typeof mockPool>["query"]) => query.mock.calls[0][1];

describe("PostgresEntitlementStore", () => {

    it("registers an app-scoped definition as an upsert on the (app, id) key", async () => {
        const { pool, query } = mockPool();

        await new PostgresEntitlementStore(pool).register("crm", "export", "Can export");

        expect(sqlOf(query)).toContain("INSERT INTO entitlements");
        expect(sqlOf(query)).toContain("ON CONFLICT (COALESCE(app_id, ''), entitlement_id) DO UPDATE");
        expect(paramsOf(query)).toEqual(["crm", "export", "Can export"]);
    });

    it("defines a global entitlement with a null app id", async () => {
        const { pool, query } = mockPool();

        await new PostgresEntitlementStore(pool).defineGlobal("access", "Global access");

        expect(paramsOf(query)).toEqual([null, "access", "Global access"]);
    });

    it("has matches a grant for the app or a global grant", async () => {
        const { pool, query } = mockPool([{ "?column?": 1 }]);

        expect(await new PostgresEntitlementStore(pool).has("crm", "ada", "export")).toBe(true);

        expect(sqlOf(query)).toContain("(app_id = $3 OR app_id IS NULL)");
        expect(paramsOf(query)).toEqual(["ada", "export", "crm"]);
    });

    it("has is false with no matching grant", async () => {
        const { pool } = mockPool([], 0);

        expect(await new PostgresEntitlementStore(pool).has("crm", "ada", "export")).toBe(false);
    });

    it("grant inserts a new row and returns it with its generated id", async () => {
        const grantedAt = new Date("2026-09-21T10:00:00Z");
        const { pool, query } = mockPool([{ granted_at: grantedAt }]);

        const grant = await new PostgresEntitlementStore(pool).grant("ada", null, "access", "welcome", "admin-1");

        expect(sqlOf(query)).toContain("INSERT INTO entitlement_grants");
        expect(paramsOf(query)).toEqual([grant.id, "ada", null, "access", "welcome", "admin-1"]);
        expect(grant).toMatchObject({
            userId: "ada", appId: null, entitlementId: "access", notes: "welcome", grantedBy: "admin-1",
            grantedAt: "2026-09-21T10:00:00.000Z",
        });
        expect(grant.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("revoke reports whether a row was deleted", async () => {
        const deleted = mockPool([], 1);
        const missing = mockPool([], 0);

        expect(await new PostgresEntitlementStore(deleted.pool).revoke("g1")).toBe(true);
        expect(await new PostgresEntitlementStore(missing.pool).revoke("g2")).toBe(false);
        expect(paramsOf(deleted.query)).toEqual(["g1"]);
    });

    it("lists grants, optionally for one user, mapping the columns", async () => {
        const row = {
            id: "g1", user_id: "ada", app_id: "crm", entitlement_id: "export", notes: "",
            granted_at: new Date("2026-09-21T10:00:00Z"), granted_by: "admin-1",
        };
        const all = mockPool([row]);
        const forUser = mockPool([row]);

        const grants = await new PostgresEntitlementStore(all.pool).listGrants();
        await new PostgresEntitlementStore(forUser.pool).listGrants("ada");

        expect(grants).toEqual([{
            id: "g1", userId: "ada", appId: "crm", entitlementId: "export", notes: "",
            grantedAt: "2026-09-21T10:00:00.000Z", grantedBy: "admin-1",
        }]);
        expect(sqlOf(all.query)).not.toContain("WHERE");
        expect(sqlOf(forUser.query)).toContain("WHERE user_id = $1");
        expect(paramsOf(forUser.query)).toEqual(["ada"]);
    });

    it("lists definitions with global ones first", async () => {
        const { pool, query } = mockPool([
            { app_id: null, entitlement_id: "access", notes: "Global access" },
            { app_id: "crm", entitlement_id: "export", notes: "" },
        ]);

        const definitions = await new PostgresEntitlementStore(pool).listDefinitions();

        expect(definitions).toEqual([
            { appId: null, entitlementId: "access", notes: "Global access" },
            { appId: "crm", entitlementId: "export", notes: "" },
        ]);
        expect(sqlOf(query)).toContain("ORDER BY app_id NULLS FIRST");
    });

});
