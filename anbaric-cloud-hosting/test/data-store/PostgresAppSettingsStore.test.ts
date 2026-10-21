import {describe, expect, it, vi} from "vitest";
import {Pool} from "pg";
import {PostgresAppSettingsStore} from "../../src/data-store/PostgresAppSettingsStore";

const mockPool = (answers : Array<Array<any>>) => {
    const query = vi.fn(async (_sql : string, _params? : Array<any>) => {
        const rows = answers.shift() ?? [];
        return { rows, rowCount: rows.length };
    });
    return { pool: { query } as unknown as Pool, query };
};

describe("PostgresAppSettingsStore", () => {

    it("reads an app's row, and defaults an app with none", async () => {
        const { pool } = mockPool([[{ app_name: "crm", zero_downtime: true, public: true }], []]);
        const store = new PostgresAppSettingsStore(pool);

        expect(await store.get("crm")).toEqual({ appName: "crm", zeroDowntime: true, public: true });
        expect(await store.get("other")).toEqual({ appName: "other", zeroDowntime: false, public: false });
    });

    it("upserts a setting on top of what the app already has", async () => {
        const { pool, query } = mockPool([[], [{ app_name: "crm", zero_downtime: true, public: false }]]);

        const settings = await new PostgresAppSettingsStore(pool).set("crm", { zeroDowntime: true });

        const upsert = query.mock.calls[1];
        expect(String(upsert[0])).toContain("ON CONFLICT (app_name) DO UPDATE");
        expect(upsert[1]).toEqual(["crm", true, false]);
        expect(settings).toEqual({ appName: "crm", zeroDowntime: true, public: false });
    });

    it("lists every configured app and removes one by name", async () => {
        const { pool, query } = mockPool([[{ app_name: "a", zero_downtime: false }, { app_name: "b", zero_downtime: true }], []]);
        const store = new PostgresAppSettingsStore(pool);

        expect((await store.list()).map(each => each.appName)).toEqual(["a", "b"]);
        await store.remove("a");

        expect(String(query.mock.calls[1][0])).toContain("DELETE FROM app_settings");
        expect(query.mock.calls[1][1]).toEqual(["a"]);
    });

});
