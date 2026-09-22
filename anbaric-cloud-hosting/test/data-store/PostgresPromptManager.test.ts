import {describe, expect, it, vi} from "vitest";
import {Pool} from "pg";
import {PostgresPromptManager} from "../../src/data-store/PostgresPromptManager";

const row = (version : number, instructions : string, over : object = {}) => ({
    app_id: "crm", prompt_id: "triage", version, instructions, input_schema: null, output_schema: { type: "object" },
    created_at: new Date("2026-09-22T10:00:00Z"), ...over,
});

const mockClient = (results : Array<{ rows : Array<any> }>) => {
    let call = 0;
    const query = vi.fn(async (_sql : string, _params? : Array<any>) => results[call++] ?? { rows: [] });
    return { query, release: vi.fn() };
};

const mockPool = (client = mockClient([]), rows : Array<any> = []) => {
    const query = vi.fn(async (_sql : string, _params? : Array<any>) => ({ rows, rowCount: rows.length }));
    return { pool: { query, connect: vi.fn(async () => client) } as unknown as Pool, query, client };
};

const statements = (client : ReturnType<typeof mockClient>) => client.query.mock.calls.map(call => String(call[0]).trim().split(/\s+/)[0]);

describe("PostgresPromptManager", () => {

    it("saves the first version when there is none, in a transaction with the latest row locked", async () => {
        const client = mockClient([{ rows: [] }, { rows: [] }, { rows: [row(1, "Decide.")] }, { rows: [] }]);
        const { pool } = mockPool(client);

        const saved = await new PostgresPromptManager(pool, "crm").save("triage", "Decide.", undefined, { type: "object" });

        expect(statements(client)).toEqual(["BEGIN", "SELECT", "INSERT", "COMMIT"]);
        expect(String(client.query.mock.calls[1][0])).toContain("FOR UPDATE");
        expect(client.query.mock.calls[2][1]).toEqual(["crm", "triage", 1, "Decide.", null, JSON.stringify({ type: "object" })]);
        expect(saved).toMatchObject({ appId: "crm", promptId: "triage", version: 1, outputSchema: { type: "object" }, createdAt: "2026-09-22T10:00:00.000Z" });
        expect(saved.inputSchema).toBeUndefined();
        expect(client.release).toHaveBeenCalled();
    });

    it("writes the next version when the content changed", async () => {
        const client = mockClient([{ rows: [] }, { rows: [row(3, "Old.")] }, { rows: [row(4, "New.")] }, { rows: [] }]);
        const { pool } = mockPool(client);

        const saved = await new PostgresPromptManager(pool, "crm").save("triage", "New.", undefined, { type: "object" });

        expect(client.query.mock.calls[2][1]![2]).toBe(4);
        expect(saved.version).toBe(4);
    });

    it("returns the latest untouched when the content is identical", async () => {
        const client = mockClient([{ rows: [] }, { rows: [row(3, "Same.")] }, { rows: [] }]);
        const { pool } = mockPool(client);

        const saved = await new PostgresPromptManager(pool, "crm").save("triage", "Same.", undefined, { type: "object" });

        expect(statements(client)).toEqual(["BEGIN", "SELECT", "COMMIT"]);
        expect(saved.version).toBe(3);
    });

    it("rolls back when the insert fails", async () => {
        const client = mockClient([{ rows: [] }, { rows: [] }]);
        client.query.mockImplementationOnce(async () => ({ rows: [] }))
            .mockImplementationOnce(async () => ({ rows: [] }))
            .mockImplementationOnce(async () => { throw new Error("duplicate key"); });
        const { pool } = mockPool(client);

        await expect(new PostgresPromptManager(pool, "crm").save("triage", "x")).rejects.toThrow("duplicate key");

        expect(statements(client)).toEqual(["BEGIN", "SELECT", "INSERT", "ROLLBACK"]);
        expect(client.release).toHaveBeenCalled();
    });

    it("retrieves the latest by default and a named version when asked", async () => {
        const latest = mockPool(undefined, [row(2, "v2")]);
        const named = mockPool(undefined, [row(1, "v1")]);

        expect((await new PostgresPromptManager(latest.pool, "crm").retrieve("triage")).version).toBe(2);
        expect(String(latest.query.mock.calls[0][0])).toContain("ORDER BY version DESC LIMIT 1");
        expect((await new PostgresPromptManager(named.pool, "crm").retrieve("triage", 1)).version).toBe(1);
        expect(named.query.mock.calls[0][1]).toEqual(["crm", "triage", 1]);
    });

    it("throws for an unknown prompt", async () => {
        const { pool } = mockPool(undefined, []);

        await expect(new PostgresPromptManager(pool, "crm").retrieve("nope")).rejects.toThrow('No prompt found with id "nope"');
        await expect(new PostgresPromptManager(pool, "crm").retrieve("nope", 2)).rejects.toThrow('at version 2');
    });

    it("lists the latest version per prompt and a prompt's history newest first", async () => {
        const listed = mockPool(undefined, [row(2, "v2")]);
        const history = mockPool(undefined, [row(2, "v2"), row(1, "v1")]);

        await new PostgresPromptManager(listed.pool, "crm").list();
        const versions = await new PostgresPromptManager(history.pool, "crm").history("triage");

        expect(String(listed.query.mock.calls[0][0])).toContain("DISTINCT ON (prompt_id)");
        expect(String(history.query.mock.calls[0][0])).toContain("ORDER BY version DESC");
        expect(versions.map(prompt => prompt.version)).toEqual([2, 1]);
    });

});
