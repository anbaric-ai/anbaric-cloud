import {describe, expect, it, vi} from "vitest";
import {Pool} from "pg";
import {PostgresAppDocsStore} from "../../src/data-store/PostgresAppDocsStore";

const mockClient = () => {
    const query = vi.fn(async (_sql : string, _params? : Array<any>) => ({ rows: [] as Array<any>, rowCount: 0 }));
    const release = vi.fn();
    return { query, release };
};

const mockPool = (client = mockClient()) =>
    ({ pool: { connect: vi.fn(async () => client) } as unknown as Pool, client });

describe("PostgresAppDocsStore", () => {

    it("replaces an app's docs in one transaction: delete then insert", async () => {
        const { pool, client } = mockPool();

        await new PostgresAppDocsStore(pool).replaceForApp("crm", [
            { slug: "overview", title: "Overview", markdown: "# Overview" },
            { slug: "workflows", title: "Workflows", markdown: "# Workflows" },
        ]);

        const sql = client.query.mock.calls.map(call => String(call[0]).trim().split(/\s+/)[0]);
        expect(sql).toEqual(["BEGIN", "DELETE", "INSERT", "COMMIT"]);
        expect(client.release).toHaveBeenCalled();
    });

    it("deletes even when there are no new docs, so a redeploy that produces none clears them", async () => {
        const { pool, client } = mockPool();

        await new PostgresAppDocsStore(pool).replaceForApp("crm", []);

        const sql = client.query.mock.calls.map(call => String(call[0]).trim().split(/\s+/)[0]);
        expect(sql).toEqual(["BEGIN", "DELETE", "COMMIT"]);
    });

    it("scopes the delete to the one app", async () => {
        const { pool, client } = mockPool();

        await new PostgresAppDocsStore(pool).replaceForApp("crm", []);

        const del = client.query.mock.calls.find(call => String(call[0]).includes("DELETE"));
        expect(del![1]).toEqual(["crm"]);
    });

    it("rolls back and releases the client when the insert fails", async () => {
        const client = mockClient();
        client.query.mockImplementation(async (sql : string) => {
            if (String(sql).startsWith("INSERT")) throw new Error("constraint");
            return { rows: [], rowCount: 0 };
        });
        const { pool } = mockPool(client);

        await expect(new PostgresAppDocsStore(pool).replaceForApp("crm", [
            { slug: "x", title: "X", markdown: "x" },
        ])).rejects.toThrow("constraint");

        expect(client.query.mock.calls.some(call => String(call[0]).includes("ROLLBACK"))).toBe(true);
        expect(client.release).toHaveBeenCalled();
    });

});
