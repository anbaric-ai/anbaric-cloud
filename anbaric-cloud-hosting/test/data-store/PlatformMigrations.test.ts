import {describe, expect, it, vi} from "vitest";
import {Pool} from "pg";
import {migrate} from "../../src/data-store/Migrations";
import {PLATFORM_MIGRATIONS} from "../../src/data-store/PlatformMigrations";

const recordingPool = () => {
    const sql : Array<string> = [];
    const client = {
        query: vi.fn(async (statement : string) => {
            sql.push(String(statement));
            return { rows: [], rowCount: 0 };
        }),
        release: vi.fn(),
    };
    return { pool: { connect: vi.fn(async () => client) } as unknown as Pool, sql };
};

describe("PLATFORM_MIGRATIONS", () => {

    it("names each migration once, so none is silently skipped", () => {
        const ids = PLATFORM_MIGRATIONS.map(migration => migration.id);

        expect(new Set(ids).size).toBe(ids.length);
    });

    it("keeps the ids in the order they are applied", () => {
        const ids = PLATFORM_MIGRATIONS.map(migration => migration.id);

        expect([...ids].sort()).toEqual(ids);
    });

    it("creates the tables the platform reads from", async () => {
        const { pool, sql } = recordingPool();

        await migrate(pool, PLATFORM_MIGRATIONS);

        const all = sql.join("\n");
        for (const table of ["jobs", "awaits", "documents", "queue", "job_run_schedule", "app_docs",
                             "entitlements", "entitlement_grants", "prompts",
                             "anbaric_system.cli_keys", "anbaric_system.users", "anbaric_system.audit_records"]) {
            expect(all).toContain(`CREATE TABLE IF NOT EXISTS ${table} (`);
        }
    });

});
