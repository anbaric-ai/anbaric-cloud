import {describe, expect, it, vi} from "vitest";
import {Pool} from "pg";
import {migrate, statements} from "../../src/data-store/Migrations";

/* A pool whose client remembers every statement, and reports whichever
   migration ids the test says are already recorded. */
const mockPool = (alreadyApplied : Array<string> = []) => {
    const run : Array<string> = [];
    const query = vi.fn(async (sql : string, _params? : Array<any>) => {
        run.push(String(sql).trim().split(/\s+/).slice(0, 2).join(" "));
        if (String(sql).includes("SELECT id FROM")) return { rows: alreadyApplied.map(id => ({ id })), rowCount: alreadyApplied.length };
        return { rows: [], rowCount: 0 };
    });
    const client = { query, release: vi.fn() };
    return { pool: { connect: vi.fn(async () => client) } as unknown as Pool, client, run };
};

const recorded = (client : { query : ReturnType<typeof vi.fn> }) =>
    client.query.mock.calls.filter(call => String(call[0]).startsWith("INSERT INTO")).map(call => call[1]?.[0]);

describe("migrate", () => {

    it("applies each migration once, in order, recording it", async () => {
        const { pool, client } = mockPool();

        const applied = await migrate(pool, [
            statements("001-first", "CREATE TABLE a ()"),
            statements("002-second", "ALTER TABLE a ADD COLUMN b TEXT"),
        ]);

        expect(applied).toEqual(["001-first", "002-second"]);
        expect(recorded(client)).toEqual(["001-first", "002-second"]);
    });

    it("skips what has already been applied", async () => {
        const { pool, client } = mockPool(["001-first"]);
        const first = vi.fn(async () => {});

        const applied = await migrate(pool, [
            { id: "001-first", run: first },
            statements("002-second", "ALTER TABLE a ADD COLUMN b TEXT"),
        ]);

        expect(applied).toEqual(["002-second"]);
        expect(first).not.toHaveBeenCalled();
    });

    it("does nothing at all on a database that is up to date", async () => {
        const { pool, client } = mockPool(["001-first"]);

        expect(await migrate(pool, [statements("001-first", "CREATE TABLE a ()")])).toEqual([]);
        expect(recorded(client)).toEqual([]);
    });

    it("wraps each migration in its own transaction", async () => {
        const { pool, run } = mockPool();

        await migrate(pool, [statements("001-first", "CREATE TABLE a ()")]);

        expect(run).toContain("BEGIN");
        expect(run).toContain("COMMIT");
        expect(run.indexOf("BEGIN")).toBeLessThan(run.indexOf("COMMIT"));
    });

    it("rolls back and stops the boot when a migration fails, naming it", async () => {
        const { pool, run } = mockPool();
        const later = vi.fn(async () => {});

        await expect(migrate(pool, [
            { id: "001-first", run: async () => { throw new Error("syntax error"); } },
            { id: "002-second", run: later },
        ])).rejects.toThrow('Migration "001-first" failed: syntax error');

        expect(run).toContain("ROLLBACK");
        expect(later).not.toHaveBeenCalled();
    });

    it("takes an advisory lock so two booting instances take turns, and releases it", async () => {
        const { pool, client } = mockPool();

        await migrate(pool, [statements("001-first", "CREATE TABLE a ()")]);

        const locks = client.query.mock.calls.map(call => String(call[0]));
        expect(locks.some(sql => sql.includes("pg_advisory_lock"))).toBe(true);
        expect(locks.some(sql => sql.includes("pg_advisory_unlock"))).toBe(true);
        expect(client.release).toHaveBeenCalled();
    });

    it("releases the lock and the client even when a migration throws", async () => {
        const { pool, client } = mockPool();

        await expect(migrate(pool, [{ id: "boom", run: async () => { throw new Error("no"); } }])).rejects.toThrow();

        expect(client.query.mock.calls.some(call => String(call[0]).includes("pg_advisory_unlock"))).toBe(true);
        expect(client.release).toHaveBeenCalled();
    });

    it("refuses a list with a repeated id, which would silently skip one of them", async () => {
        const { pool } = mockPool();

        await expect(migrate(pool, [
            statements("001-first", "CREATE TABLE a ()"),
            statements("001-first", "CREATE TABLE b ()"),
        ])).rejects.toThrow('Duplicate migration id "001-first"');
    });

    it("runs every statement of a multi-statement migration", async () => {
        const { pool, client } = mockPool();

        await migrate(pool, [statements("001-first", "CREATE TABLE a ()", "CREATE INDEX i ON a (b)")]);

        const sql = client.query.mock.calls.map(call => String(call[0]));
        expect(sql).toContain("CREATE TABLE a ()");
        expect(sql).toContain("CREATE INDEX i ON a (b)");
    });

});
