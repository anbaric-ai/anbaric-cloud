import {describe, expect, it, vi} from "vitest";
import {Pool} from "pg";
import {User} from "../../src/auth/User";
import {PostgresUserDirectory} from "../../src/data-store/PostgresUserDirectory";

const mockPool = (rows : Array<any> = []) => {
    const query = vi.fn(async (_sql : string, _params? : Array<any>) => ({ rows, rowCount: rows.length }));
    return { pool: { query } as unknown as Pool, query };
};

describe("PostgresUserDirectory", () => {

    it("records a user as an upsert that refreshes their details and last-seen time", async () => {
        const { pool, query } = mockPool();

        await new PostgresUserDirectory(pool).record(new User("ada", [], [], "Ada Lovelace", "https://pic", "ada@example.com"));

        const sql = String(query.mock.calls[0][0]).replace(/\s+/g, " ");
        expect(sql).toContain("INSERT INTO anbaric_system.users");
        expect(sql).toContain("ON CONFLICT (id) DO UPDATE");
        expect(sql).toContain("last_seen = now()");
        expect(query.mock.calls[0][1]).toEqual(["ada", "Ada Lovelace", "ada@example.com", "https://pic"]);
    });

    it("blanks missing name, email and picture rather than storing undefined", async () => {
        const { pool, query } = mockPool();

        await new PostgresUserDirectory(pool).record(new User("bob"));

        expect(query.mock.calls[0][1]).toEqual(["bob", "", "", null]);
    });

    it("lists users with their timestamps as ISO strings", async () => {
        const { pool, query } = mockPool([{
            id: "ada", name: "Ada", email: "ada@example.com", picture: null,
            first_seen: new Date("2026-09-01T09:00:00Z"), last_seen: new Date("2026-09-22T09:00:00Z"),
        }]);

        const users = await new PostgresUserDirectory(pool).list();

        expect(users).toEqual([{
            id: "ada", name: "Ada", email: "ada@example.com", picture: undefined,
            firstSeenAt: "2026-09-01T09:00:00.000Z", lastSeenAt: "2026-09-22T09:00:00.000Z",
        }]);
        expect(String(query.mock.calls[0][0])).toContain("ORDER BY NULLIF(name, '') NULLS LAST, id");
    });

});
