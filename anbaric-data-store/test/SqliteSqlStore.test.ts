import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Actor, Auditor, NoOpAuditor} from "anbaric-tsapi";
import {SqliteSqlStore} from "../src/SqliteSqlStore";

const actor : Actor = { type: "CODE", id: "tester", roles: ["code"] };

describe("SqliteSqlStore", () => {

    let store : SqliteSqlStore;

    beforeEach(async () => {
        store = new SqliteSqlStore(new NoOpAuditor(), ":memory:");
        await store.execute(actor, "CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT)");
    });

    afterEach(async () => { await store.close(); });

    it("executes statements and queries rows back with ? placeholders", async () => {
        const affected = await store.execute(actor, "INSERT INTO customers (name) VALUES (?)", ["Ada"]);
        expect(affected).toBe(1);

        const rows = await store.query(actor, "SELECT id, name FROM customers WHERE name = ?", ["Ada"]);
        expect(rows).toEqual([{ id: 1, name: "Ada" }]);
    });

    it("returns the number of affected rows from execute", async () => {
        await store.execute(actor, "INSERT INTO customers (name) VALUES (?), (?)", ["Ada", "Grace"]);
        expect(await store.execute(actor, "UPDATE customers SET name = ? WHERE 1=1", ["Anon"])).toBe(2);
    });

    it("audits query as QUERY and execute as EXECUTE", async () => {
        const auditor = { audit: vi.fn(async () => {}) } satisfies Auditor;
        const audited = new SqliteSqlStore(auditor, ":memory:");
        await audited.execute(actor, "CREATE TABLE t (x INTEGER)");
        await audited.query(actor, "SELECT * FROM t");
        await audited.close();

        expect(auditor.audit).toHaveBeenCalledWith("sql", "*", actor, ["EXECUTE"], expect.stringContaining("CREATE TABLE"), null);
        expect(auditor.audit).toHaveBeenCalledWith("sql", "*", actor, ["QUERY"], "SELECT * FROM t", null);
    });

});
