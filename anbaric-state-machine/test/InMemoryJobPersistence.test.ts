import {beforeEach, describe, expect, it, vi} from "vitest";
import {Actor, Auditor, Job} from "anbaric-tsapi";
import {InMemoryJobPersistence} from "../src/persistence/InMemoryJobPersistence";

const makeJob = (id : string, properties : Map<string, any> = new Map()) => new Job(id, properties, "start");
const actor : Actor = { type: "CODE", id: "tester", roles: ["code"] };

describe("InMemoryJobPersistence", () => {

    let persistence : InMemoryJobPersistence;

    beforeEach(() => {
        persistence = new InMemoryJobPersistence();
    });

    describe("create and retrieve", () => {

        it("round-trips a job by id", async () => {
            const job = makeJob("job-1");

            await persistence.create(actor, job);

            expect(await persistence.retrieve("job-1", actor)).toBe(job);
        });

        it("overwrites an existing job with the same id", async () => {
            const original = makeJob("job-1", new Map([["version", 1]]));
            const replacement = makeJob("job-1", new Map([["version", 2]]));

            await persistence.create(actor, original);
            await persistence.create(actor, replacement);

            expect(await persistence.retrieve("job-1", actor)).toBe(replacement);
        });

        it("rejects retrieval of an unknown id", async () => {
            await expect(persistence.retrieve("missing", actor)).rejects.toThrowError('No job found with id "missing"');
        });

    });

    describe("save", () => {

        it("merges the given properties into a new version of the job", async () => {
            await persistence.create(actor, makeJob("job-1", new Map([["colour", "red"]])));
            const job = await persistence.retrieve("job-1", actor);

            await persistence.save(actor, "Painted", job, new Map([["size", "large"]]));

            const updated = await persistence.retrieve("job-1", actor);
            expect(updated.properties.get("colour")).toBe("red");
            expect(updated.properties.get("size")).toBe("large");
        });

        it("moves the job to the given state", async () => {
            await persistence.create(actor, makeJob("job-1"));
            const job = await persistence.retrieve("job-1", actor);

            await persistence.save(actor, "Progressed", job, undefined, "done");

            expect((await persistence.retrieve("job-1", actor)).state).toBe("done");
        });

    });

    describe("delete", () => {

        it("removes a saved job", async () => {
            await persistence.create(actor, makeJob("job-1"));

            await persistence.delete("job-1", actor);

            await expect(persistence.retrieve("job-1", actor)).rejects.toThrowError();
        });

        it("tolerates unknown ids", async () => {
            await expect(persistence.delete("missing", actor)).resolves.toBeUndefined();
        });

    });

    describe("list", () => {

        it("returns jobs in insertion order", async () => {
            await persistence.create(actor, makeJob("a"));
            await persistence.create(actor, makeJob("b"));
            await persistence.create(actor, makeJob("c"));

            expect((await persistence.list(actor)).map(job => job.id)).toEqual(["a", "b", "c"]);
        });

        it("returns the requested page", async () => {
            for (const id of ["a", "b", "c", "d", "e"]) {
                await persistence.create(actor, makeJob(id));
            }

            expect((await persistence.list(actor, 2, 0)).map(job => job.id)).toEqual(["a", "b"]);
            expect((await persistence.list(actor, 2, 1)).map(job => job.id)).toEqual(["c", "d"]);
            expect((await persistence.list(actor, 2, 2)).map(job => job.id)).toEqual(["e"]);
        });

        it("returns an empty page past the end", async () => {
            await persistence.create(actor, makeJob("a"));

            expect(await persistence.list(actor, 2, 5)).toEqual([]);
        });

        it("defaults to the first hundred jobs", async () => {
            for (let i = 0; i < 150; i++) {
                await persistence.create(actor, makeJob(`job-${i}`));
            }

            const listed = await persistence.list(actor);

            expect(listed.length).toBe(100);
            expect(listed[0].id).toBe("job-0");
            expect(listed[99].id).toBe("job-99");
        });

    });

    describe("killing", () => {

        it("marks a job killed", async () => {
            await persistence.create(actor, makeJob("job-1"));

            await persistence.kill("job-1", actor);

            expect((await persistence.retrieve("job-1", actor)).killed).toBe(true);
        });

        it("kills jobs last updated before the cutoff, skipping already-killed ones", async () => {
            await persistence.create(actor, new Job("old", new Map(), "start", "wf", "system", new Date("2020-01-01"), new Date("2020-01-01")));
            await persistence.create(actor, new Job("recent", new Map(), "start", "wf", "system", new Date(), new Date()));

            const cutoff = new Date("2021-01-01");
            expect(await persistence.killOlderThan(cutoff, actor)).toBe(1);
            expect((await persistence.retrieve("old", actor)).killed).toBe(true);
            expect((await persistence.retrieve("recent", actor)).killed).toBe(false);
            expect(await persistence.killOlderThan(cutoff, actor)).toBe(0);
        });

        it("preserves the killed flag across a later save", async () => {
            await persistence.create(actor, makeJob("job-1"));
            await persistence.kill("job-1", actor);

            await persistence.save(actor, "touch", await persistence.retrieve("job-1", actor), new Map([["x", 1]]));

            expect((await persistence.retrieve("job-1", actor)).killed).toBe(true);
        });

    });

    describe("countByState", () => {

        it("counts jobs by state and killed flag", async () => {
            await persistence.create(actor, makeJob("a"));
            await persistence.create(actor, makeJob("b"));
            await persistence.create(actor, new Job("c", new Map(), "done"));
            await persistence.kill("c", actor);

            const counts = await persistence.countByState(actor);

            expect(counts).toContainEqual({ state: "start", killed: false, count: 2 });
            expect(counts).toContainEqual({ state: "done", killed: true, count: 1 });
        });

    });

    describe("auditing", () => {

        it("audits each interaction against the injected auditor before touching the store", async () => {
            const audit = vi.fn(async (_resourceType : string, _resourceId : string, _actor : any,
                                       _interaction : any, _description : string, _details : any) => {});
            const audited = new InMemoryJobPersistence({ audit } as unknown as Auditor);

            await audited.create(actor, makeJob("job-1"));
            await audited.retrieve("job-1", actor);
            await audited.delete("job-1", actor);
            await audited.list(actor);

            expect(audit.mock.calls.map(call => [call[0], call[1], call[3]])).toEqual([
                ["job", "job-1", ["CREATE"]],
                ["job", "job-1", ["READ"]],
                ["job", "job-1", ["DELETE"]],
                ["job", "*", ["LIST"]],
            ]);
        });

    });

});
