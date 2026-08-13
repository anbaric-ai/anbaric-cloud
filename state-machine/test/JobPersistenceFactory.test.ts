import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {InMemoryJobPersistence} from "../src/persistence/InMemoryJobPersistence";
import {JobPersistenceFactory} from "../src/persistence/JobPersistenceFactory";

describe("JobPersistenceFactory", () => {

    let originalPersistenceType : string | undefined;

    beforeEach(() => {
        originalPersistenceType = process.env.ANBARIC_JOB_PERSISTENCE_TYPE;
    });

    afterEach(() => {
        if (originalPersistenceType === undefined) {
            delete process.env.ANBARIC_JOB_PERSISTENCE_TYPE;
        } else {
            process.env.ANBARIC_JOB_PERSISTENCE_TYPE = originalPersistenceType;
        }
    });

    it("defaults to in-memory persistence when the env var is unset", () => {
        delete process.env.ANBARIC_JOB_PERSISTENCE_TYPE;

        expect(JobPersistenceFactory.instance()).toBeInstanceOf(InMemoryJobPersistence);
    });

    it("returns in-memory persistence for the memory type", () => {
        process.env.ANBARIC_JOB_PERSISTENCE_TYPE = "memory";

        expect(JobPersistenceFactory.instance()).toBeInstanceOf(InMemoryJobPersistence);
    });

    it("rejects the not-yet-implemented postgres type", () => {
        process.env.ANBARIC_JOB_PERSISTENCE_TYPE = "postgres";

        expect(() => JobPersistenceFactory.instance()).toThrowError("Not implemented");
    });

    it("returns a fresh store per call", () => {
        expect(JobPersistenceFactory.instance()).not.toBe(JobPersistenceFactory.instance());
    });

});
