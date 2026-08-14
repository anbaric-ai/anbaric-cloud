import {beforeEach, describe, expect, it} from "vitest";
import {Job} from "anbaric-tsapi";
import {InMemoryJobPersistence} from "../src/persistence/InMemoryJobPersistence";

const makeJob = (id : string, properties : Map<string, any> = new Map()) => new Job(id, properties, "start");

describe("InMemoryJobPersistence", () => {

    let persistence : InMemoryJobPersistence;

    beforeEach(() => {
        persistence = new InMemoryJobPersistence();
    });

    describe("save and retrieve", () => {

        it("round-trips a job by id", async () => {
            const job = makeJob("job-1");

            await persistence.save(job);

            expect(await persistence.retrieve("job-1")).toBe(job);
        });

        it("overwrites an existing job with the same id", async () => {
            const original = makeJob("job-1", new Map([["version", 1]]));
            const replacement = makeJob("job-1", new Map([["version", 2]]));

            await persistence.save(original);
            await persistence.save(replacement);

            expect(await persistence.retrieve("job-1")).toBe(replacement);
        });

        it("rejects retrieval of an unknown id", async () => {
            await expect(persistence.retrieve("missing")).rejects.toThrowError('No job found with id "missing"');
        });

    });

    describe("delete", () => {

        it("removes a saved job", async () => {
            await persistence.save(makeJob("job-1"));

            await persistence.delete("job-1");

            await expect(persistence.retrieve("job-1")).rejects.toThrowError();
        });

        it("tolerates unknown ids", async () => {
            await expect(persistence.delete("missing")).resolves.toBeUndefined();
        });

    });

    describe("list", () => {

        it("returns jobs in insertion order", async () => {
            await persistence.save(makeJob("a"));
            await persistence.save(makeJob("b"));
            await persistence.save(makeJob("c"));

            expect((await persistence.list()).map(job => job.id)).toEqual(["a", "b", "c"]);
        });

        it("returns the requested page", async () => {
            for (const id of ["a", "b", "c", "d", "e"]) {
                await persistence.save(makeJob(id));
            }

            expect((await persistence.list(2, 0)).map(job => job.id)).toEqual(["a", "b"]);
            expect((await persistence.list(2, 1)).map(job => job.id)).toEqual(["c", "d"]);
            expect((await persistence.list(2, 2)).map(job => job.id)).toEqual(["e"]);
        });

        it("returns an empty page past the end", async () => {
            await persistence.save(makeJob("a"));

            expect(await persistence.list(2, 5)).toEqual([]);
        });

        it("defaults to the first hundred jobs", async () => {
            for (let i = 0; i < 150; i++) {
                await persistence.save(makeJob(`job-${i}`));
            }

            const listed = await persistence.list();

            expect(listed.length).toBe(100);
            expect(listed[0].id).toBe("job-0");
            expect(listed[99].id).toBe("job-99");
        });

    });

    describe("updateProperties", () => {

        it("merges new keys into the existing properties", async () => {
            await persistence.save(makeJob("job-1", new Map([["colour", "red"]])));

            await persistence.updateProperties("job-1", new Map([["size", "large"]]));

            const job = await persistence.retrieve("job-1");
            expect(job.properties.get("colour")).toBe("red");
            expect(job.properties.get("size")).toBe("large");
        });

        it("overwrites existing keys", async () => {
            await persistence.save(makeJob("job-1", new Map([["colour", "red"]])));

            await persistence.updateProperties("job-1", new Map([["colour", "blue"]]));

            expect((await persistence.retrieve("job-1")).properties.get("colour")).toBe("blue");
        });

        it("rejects updates for an unknown job", async () => {
            await expect(persistence.updateProperties("missing", new Map())).rejects.toThrowError();
        });

    });

});
