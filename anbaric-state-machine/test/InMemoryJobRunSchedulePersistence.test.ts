import {describe, expect, it} from "vitest";
import {InMemoryJobRunSchedulePersistence} from "../src/scheduling/InMemoryJobRunSchedulePersistence.js";

const at = (iso : string) => new Date(iso);

const run = (workflowId : string, iso : string, appId : string = "crm") => ({ appId, workflowId, runAt: at(iso) });

describe("InMemoryJobRunSchedulePersistence", () => {

    it("claims a due run once", async () => {
        const persistence = new InMemoryJobRunSchedulePersistence();
        await persistence.plan([run("sync", "2026-03-01T09:00:00Z")]);

        expect(await persistence.claimDue(at("2026-03-01T09:00:00Z"))).toEqual([run("sync", "2026-03-01T09:00:00Z")]);
        expect(await persistence.claimDue(at("2026-03-01T09:00:00Z"))).toEqual([]);
    });

    it("leaves a run that is not yet due", async () => {
        const persistence = new InMemoryJobRunSchedulePersistence();
        await persistence.plan([run("sync", "2026-03-01T09:00:00Z")]);

        expect(await persistence.claimDue(at("2026-03-01T08:59:59Z"))).toEqual([]);
    });

    it("claims only the most recent of a machine's overdue runs and marks the rest superseded by it", async () => {
        const persistence = new InMemoryJobRunSchedulePersistence();
        await persistence.plan([
            run("sync", "2026-03-01T09:00:00Z"),
            run("sync", "2026-03-01T10:00:00Z"),
            run("sync", "2026-03-01T11:00:00Z"),
            run("sync", "2026-03-01T12:00:00Z"),
        ]);

        const claimed = await persistence.claimDue(at("2026-03-01T11:30:00Z"));

        expect(claimed).toEqual([run("sync", "2026-03-01T11:00:00Z")]);
        expect(persistence.superseded()).toEqual([
            { run: run("sync", "2026-03-01T09:00:00Z"), by: run("sync", "2026-03-01T11:00:00Z") },
            { run: run("sync", "2026-03-01T10:00:00Z"), by: run("sync", "2026-03-01T11:00:00Z") },
        ]);
        expect(await persistence.claimDue(at("2026-03-01T12:00:00Z"))).toEqual([run("sync", "2026-03-01T12:00:00Z")]);
    });

    it("coalesces per machine, never across machines or apps", async () => {
        const persistence = new InMemoryJobRunSchedulePersistence();
        await persistence.plan([
            run("sync", "2026-03-01T09:00:00Z"),
            run("sync", "2026-03-01T10:00:00Z"),
            run("digest", "2026-03-01T09:30:00Z"),
            run("sync", "2026-03-01T09:45:00Z", "billing"),
        ]);

        const claimed = await persistence.claimDue(at("2026-03-01T10:00:00Z"));

        expect(claimed).toEqual([
            run("digest", "2026-03-01T09:30:00Z"),
            run("sync", "2026-03-01T09:45:00Z", "billing"),
            run("sync", "2026-03-01T10:00:00Z"),
        ]);
        expect(persistence.superseded().map(({ run }) => run)).toEqual([run("sync", "2026-03-01T09:00:00Z")]);
    });

});
