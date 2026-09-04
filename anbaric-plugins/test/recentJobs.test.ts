import {describe, expect, it} from "vitest";
import {mostRecent} from "../src/state-machines/recentJobs";
import type {Job} from "../src/state-machines/types";

const job = (id : string, times : { started? : string, updated? : string }) : Job => ({
    id,
    state: "new",
    properties: {},
    startedAt: times.started,
    lastUpdated: times.updated,
});

describe("mostRecent", () => {

    it("orders jobs by when they were last updated, newest first", () => {
        const ordered = mostRecent([
            job("older", { updated: "2026-01-01T00:00:00Z" }),
            job("newest", { updated: "2026-03-01T00:00:00Z" }),
            job("middle", { updated: "2026-02-01T00:00:00Z" }),
        ]);

        expect(ordered.map(entry => entry.id)).toEqual(["newest", "middle", "older"]);
    });

    it("falls back to the start time for a job that has never been updated", () => {
        const ordered = mostRecent([
            job("updated-long-ago", { updated: "2026-01-01T00:00:00Z" }),
            job("only-started", { started: "2026-02-01T00:00:00Z" }),
        ]);

        expect(ordered.map(entry => entry.id)).toEqual(["only-started", "updated-long-ago"]);
    });

    it("keeps only the requested number of jobs", () => {
        const jobs = Array.from({ length: 25 }, (_, index) =>
            job(`job-${index}`, { updated: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00Z` }));

        expect(mostRecent(jobs, 10)).toHaveLength(10);
    });

    it("puts a job with no timestamps at all last", () => {
        const ordered = mostRecent([job("undated", {}), job("dated", { updated: "2026-01-01T00:00:00Z" })]);

        expect(ordered.map(entry => entry.id)).toEqual(["dated", "undated"]);
    });

    it("does not mutate the array it is given", () => {
        const jobs = [job("a", { updated: "2026-01-01T00:00:00Z" }), job("b", { updated: "2026-02-01T00:00:00Z" })];

        mostRecent(jobs);

        expect(jobs.map(entry => entry.id)).toEqual(["a", "b"]);
    });

});
