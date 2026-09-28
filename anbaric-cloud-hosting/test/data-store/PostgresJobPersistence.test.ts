import {describe, expect, it, vi} from "vitest";
import {Actor, Job} from "anbaric-tsapi";
import {Pool} from "pg";
import {PostgresJobPersistence} from "../../src/data-store/PostgresJobPersistence";

const actor : Actor = { type: "CODE", id: "test", roles: ["test"] };

const mockPool = () => {
    const query = vi.fn(async (_sql : string, _params? : Array<any>) => ({ rows: [] as Array<any>, rowCount: 0 }));
    let release : () => void = () => {};
    const released = new Promise<void>(resolve => { release = resolve; });
    const connect = vi.fn(async () => ({ query, release }));
    return { pool: { query, connect } as unknown as Pool, query, released };
};

describe("PostgresJobPersistence", () => {

    it("writes the killed flag when saving a job", async () => {
        const { pool, query, released } = mockPool();

        await new PostgresJobPersistence(pool).create(actor,
            new Job("job-1", new Map(), "start", "wf", undefined, "system", new Date(), new Date(), true));
        await released;

        const insert = query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO jobs"));
        expect(insert).toBeDefined();
        expect(insert![1]![7]).toBe(true);
    });

    it("writes properties as rows of their own, only the ones given", async () => {
        const { pool, query, released } = mockPool();
        const persistence = new PostgresJobPersistence(pool);

        await persistence.create(actor, new Job("job-1", new Map<string, any>([["a", 1], ["b", { nested: true }]]), "start", "wf"));
        await released;

        const upsert = query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO job_properties"));
        expect(upsert).toBeDefined();
        expect(upsert![1]).toEqual(["job-1", ["a", "b"], ["1", "{\"nested\":true}"]]);
        expect(query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO jobs"))![0]).not.toContain("properties");
    });

    it("skips the property write when a save changed none", async () => {
        const { pool, query, released } = mockPool();

        await new PostgresJobPersistence(pool).save(actor, "State only", new Job("job-1", new Map([["a", 1]]), "start", "wf"), undefined, "next");
        await released;

        expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO job_properties"))).toBe(false);
    });

    it("reads only the keys asked for", async () => {
        const { pool, query } = mockPool();
        query.mockResolvedValueOnce({ rows: [{ id: "job-1", state: "start", started_at: new Date(), started_by: "system",
            last_updated: new Date(), killed: false, status: "active" }], rowCount: 1 });
        query.mockResolvedValueOnce({ rows: [{ job_id: "job-1", key: "a", value: 1 }], rowCount: 1 });

        const job = await new PostgresJobPersistence(pool).retrieve("job-1", actor, ["a", "c"]);

        expect([...job.properties.snapshot()]).toEqual([["a", 1]]);
        const propertiesQuery = query.mock.calls.find(([sql]) => String(sql).includes("FROM job_properties"));
        expect(propertiesQuery![0]).toContain("key = ANY($2)");
        expect(propertiesQuery![1]).toEqual([["job-1"], ["a", "c"]]);
    });

    /* A save carries the job as it was when it was read. If the upsert wrote
       killed back, a pass that started before a kill would revive the job on
       finishing - which is exactly how a killed job carried on to its next
       state. Only kill() may set the column. */
    it("leaves killed alone when updating an existing job", async () => {
        const { pool, query, released } = mockPool();

        await new PostgresJobPersistence(pool).create(actor,
            new Job("job-1", new Map(), "start", "wf", undefined, "system", new Date(), new Date(), false));
        await released;

        const insert = query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO jobs"));
        const onConflict = String(insert![0]).split("ON CONFLICT")[1];
        expect(onConflict).not.toContain("killed = EXCLUDED.killed");
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
