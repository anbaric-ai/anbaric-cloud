import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {CloudJobPersistence} from "anbaric-cloud";
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

    it("returns the cloud client for the cloud type", () => {
        process.env.ANBARIC_JOB_PERSISTENCE_TYPE = "cloud";

        expect(JobPersistenceFactory.instance()).toBeInstanceOf(CloudJobPersistence);
    });

    it("returns a fresh store per call", () => {
        expect(JobPersistenceFactory.instance()).not.toBe(JobPersistenceFactory.instance());
    });

});
