import {describe, expect, it, vi} from "vitest";
import {Pool} from "pg";
import {PostgresSkillStore} from "../../src/data-store/PostgresSkillStore";

const row = { id: "web-fetching", title: "Fetching web pages", usage_hints: "Read first", body: "POST /html",
    created_at: new Date("2026-10-01T00:00:00Z"), updated_at: new Date("2026-10-02T00:00:00Z") };

const mockPool = (answers : Array<{ rows? : Array<any>, rowCount? : number }>) => {
    const query = vi.fn(async (_sql : string, _params? : Array<any>) => {
        const answer = answers.shift() ?? { rows: [] };
        return { rows: answer.rows ?? [], rowCount: answer.rowCount ?? (answer.rows ?? []).length };
    });
    return { pool: { query } as unknown as Pool, query };
};

describe("PostgresSkillStore", () => {

    it("maps a row to a skill, and an absent one to nothing", async () => {
        const { pool } = mockPool([{ rows: [row] }, { rows: [] }]);
        const store = new PostgresSkillStore(pool);

        expect(await store.get("web-fetching")).toEqual({
            id: "web-fetching", title: "Fetching web pages", usageHints: "Read first", body: "POST /html",
            createdAt: row.created_at, updatedAt: row.updated_at,
        });
        expect(await store.get("nope")).toBeUndefined();
    });

    it("upserts on the id, touching updated_at", async () => {
        const { pool, query } = mockPool([{ rows: [row] }]);

        await new PostgresSkillStore(pool).save({ id: "web-fetching", title: "Fetching web pages", usageHints: "Read first", body: "POST /html" });

        const sql = String(query.mock.calls[0][0]).replace(/\s+/g, " ");
        expect(sql).toContain("INSERT INTO anbaric_system.skills");
        expect(sql).toContain("ON CONFLICT (id) DO UPDATE");
        expect(sql).toContain("updated_at = now()");
        expect(query.mock.calls[0][1]).toEqual(["web-fetching", "Fetching web pages", "Read first", "POST /html"]);
    });

    it("lists in id order and removes by id", async () => {
        const { pool, query } = mockPool([{ rows: [row] }, { rowCount: 1 }, { rowCount: 0 }]);
        const store = new PostgresSkillStore(pool);

        expect((await store.list()).map(skill => skill.id)).toEqual(["web-fetching"]);
        expect(String(query.mock.calls[0][0])).toContain("ORDER BY id");
        expect(await store.remove("web-fetching")).toBe(true);
        expect(await store.remove("web-fetching")).toBe(false);
    });

});
