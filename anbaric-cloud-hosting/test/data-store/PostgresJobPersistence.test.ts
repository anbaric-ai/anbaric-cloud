import {describe, expect, it, vi} from "vitest";
import {Actor, Job} from "anbaric-tsapi";
import {Pool} from "pg";
import {PostgresJobPersistence} from "../../src/data-store/PostgresJobPersistence";

const actor : Actor = { type: "CODE", id: "test", role: "test" };

const mockPool = () => {
    const query = vi.fn(async (_sql : string, _params? : Array<any>) => ({ rows: [] as Array<any>, rowCount: 0 }));
    return { pool: { query } as unknown as Pool, query };
};

describe("PostgresJobPersistence", () => {

    it("writes the killed flag when saving a job", async () => {
        const { pool, query } = mockPool();

        await new PostgresJobPersistence(pool).create(actor,
            new Job("job-1", new Map(), "start", "wf", "system", new Date(), new Date(), true));

        const [sql, params] = query.mock.calls[0];
        expect(sql).toContain("killed");
        expect(params![7]).toBe(true);
    });

    it("kills a job by id", async () => {
        const { pool, query } = mockPool();

        await new PostgresJobPersistence(pool).kill("job-1", actor);

        expect(query).toHaveBeenCalledWith("UPDATE jobs SET killed = true, last_updated = now() WHERE id = $1", ["job-1"]);
    });

    it("kills jobs older than a cutoff and returns the row count", async () => {
        const { pool, query } = mockPool();
        query.mockResolvedValueOnce({ rows: [], rowCount: 4 });
        const before = new Date("2021-01-01T00:00:00Z");

        const killed = await new PostgresJobPersistence(pool).killOlderThan(before, actor);

        expect(killed).toBe(4);
        const [sql, params] = query.mock.calls[0];
        expect(sql).toContain("killed = false");
        expect(params).toEqual([before]);
    });

    it("counts jobs grouped by state and killed flag", async () => {
        const { pool, query } = mockPool();
        query.mockResolvedValueOnce({ rows: [
            { state: "start", killed: false, count: 2 },
            { state: "done", killed: true, count: 1 },
        ], rowCount: 2 });

        expect(await new PostgresJobPersistence(pool).countByState(actor)).toEqual([
            { state: "start", killed: false, count: 2 },
            { state: "done", killed: true, count: 1 },
        ]);
    });

});
