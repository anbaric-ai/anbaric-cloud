import {describe, expect, it, vi} from "vitest";
import {Pool} from "pg";
import {PostgresStateMachineStore} from "../../src/data-store/PostgresStateMachineStore";
import {definitionHash} from "../../src/data-store/StateMachineStore";

const mockPool = (answers : Array<Array<any>>) => {
    const query = vi.fn(async (_sql : string, _params? : Array<any>) => {
        const rows = answers.shift() ?? [];
        return { rows, rowCount: rows.length };
    });
    return { pool: { query } as unknown as Pool, query };
};

const definition = { workflowId: "orders", startState: "new", dataSchema: [], states: [] };
const NOW = "2026-10-16T10:00:00.000Z";

const row = (version : number, hash : string, extra : Record<string, unknown> = {}) => ({
    app_id: "crm", workflow_id: "orders", url: "http://crm.apps:8788", version, hash,
    definition, registered_at: NOW, last_registered: NOW, ...extra,
});

describe("PostgresStateMachineStore", () => {

    it("inserts version 1 for a machine it has never seen", async () => {
        const { pool, query } = mockPool([[], [row(1, definitionHash(definition))]]);

        const machine = await new PostgresStateMachineStore(pool).register({ appId: "crm", workflowId: "orders", url: "http://crm.apps:8788", definition });

        const insert = query.mock.calls[1];
        expect(String(insert[0])).toContain("INSERT INTO anbaric_system.state_machines");
        expect(insert[1]).toEqual(["crm", "orders", "http://crm.apps:8788", 1, definitionHash(definition), JSON.stringify(definition)]);
        expect(machine).toMatchObject({ appId: "crm", workflowId: "orders", version: 1, definition });
        expect(machine.registeredAt).toEqual(new Date(NOW));
    });

    it("touches the latest version when the definition is unchanged", async () => {
        const hash = definitionHash(definition);
        const { pool, query } = mockPool([[row(3, hash)], [row(3, hash)]]);

        const machine = await new PostgresStateMachineStore(pool).register({ appId: "crm", workflowId: "orders", url: "http://crm.apps:8788", definition });

        const update = query.mock.calls[1];
        expect(String(update[0])).toContain("UPDATE anbaric_system.state_machines");
        expect(update[1]).toEqual(["crm", "orders", "http://crm.apps:8788", hash, false, JSON.stringify(definition), 3]);
        expect(machine.version).toBe(3);
    });

    it("adopts the definition into a backfilled version with no hash", async () => {
        const { pool, query } = mockPool([[row(1, "", { definition: null })], [row(1, definitionHash(definition))]]);

        await new PostgresStateMachineStore(pool).register({ appId: "crm", workflowId: "orders", url: "http://crm.apps:8788", definition });

        expect(query.mock.calls[1]![1]![4]).toBe(true);
    });

    it("inserts the next version when the definition differs", async () => {
        const { pool, query } = mockPool([[row(2, "other")], [row(3, definitionHash(definition))]]);

        const machine = await new PostgresStateMachineStore(pool).register({ appId: "crm", workflowId: "orders", url: "http://crm.apps:8788", definition });

        expect(String(query.mock.calls[1][0])).toContain("INSERT INTO");
        expect(query.mock.calls[1]![1]![3]).toBe(3);
        expect(machine.version).toBe(3);
    });

    it("lists the latest version of each machine, leaving out what a row has none of", async () => {
        const { pool, query } = mockPool([[row(2, "h", { app_id: null, url: null, definition: null })]]);

        const listed = await new PostgresStateMachineStore(pool).list();

        expect(String(query.mock.calls[0][0])).toContain("DISTINCT ON (COALESCE(app_id, ''), workflow_id)");
        expect(listed).toEqual([{ workflowId: "orders", version: 2, hash: "h", registeredAt: new Date(NOW), lastRegistered: new Date(NOW) }]);
    });

});
