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

        it("round-trips a job by id", () => {
            const job = makeJob("job-1");

            persistence.save(job);

            expect(persistence.retrieve("job-1")).toBe(job);
        });

        it("overwrites an existing job with the same id", () => {
            const original = makeJob("job-1", new Map([["version", 1]]));
            const replacement = makeJob("job-1", new Map([["version", 2]]));

            persistence.save(original);
            persistence.save(replacement);

            expect(persistence.retrieve("job-1")).toBe(replacement);
        });

        it("throws when retrieving an unknown id", () => {
            expect(() => persistence.retrieve("missing")).toThrowError('No job found with id "missing"');
        });

    });

    describe("delete", () => {

        it("removes a saved job", () => {
            persistence.save(makeJob("job-1"));

            persistence.delete("job-1");

            expect(() => persistence.retrieve("job-1")).toThrowError();
        });

        it("tolerates unknown ids", () => {
            expect(() => persistence.delete("missing")).not.toThrowError();
        });

    });

    describe("list", () => {

        it("returns jobs in insertion order", () => {
            persistence.save(makeJob("a"));
            persistence.save(makeJob("b"));
            persistence.save(makeJob("c"));

            expect(persistence.list().map(job => job.id)).toEqual(["a", "b", "c"]);
        });

        it("returns the requested page", () => {
            ["a", "b", "c", "d", "e"].forEach(id => persistence.save(makeJob(id)));

            expect(persistence.list(2, 0).map(job => job.id)).toEqual(["a", "b"]);
            expect(persistence.list(2, 1).map(job => job.id)).toEqual(["c", "d"]);
            expect(persistence.list(2, 2).map(job => job.id)).toEqual(["e"]);
        });

        it("returns an empty page past the end", () => {
            persistence.save(makeJob("a"));

            expect(persistence.list(2, 5)).toEqual([]);
        });

        it("defaults to the first hundred jobs", () => {
            for (let i = 0; i < 150; i++) {
                persistence.save(makeJob(`job-${i}`));
            }

            const listed = persistence.list();

            expect(listed.length).toBe(100);
            expect(listed[0].id).toBe("job-0");
            expect(listed[99].id).toBe("job-99");
        });

    });

    describe("updateProperties", () => {

        it("merges new keys into the existing properties", () => {
            persistence.save(makeJob("job-1", new Map([["colour", "red"]])));

            persistence.updateProperties("job-1", new Map([["size", "large"]]));

            const job = persistence.retrieve("job-1");
            expect(job.properties.get("colour")).toBe("red");
            expect(job.properties.get("size")).toBe("large");
        });

        it("overwrites existing keys", () => {
            persistence.save(makeJob("job-1", new Map([["colour", "red"]])));

            persistence.updateProperties("job-1", new Map([["colour", "blue"]]));

            expect(persistence.retrieve("job-1").properties.get("colour")).toBe("blue");
        });

        it("throws for an unknown job", () => {
            expect(() => persistence.updateProperties("missing", new Map())).toThrowError();
        });

    });

});
