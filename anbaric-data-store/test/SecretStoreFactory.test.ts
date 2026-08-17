import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {CloudSecretStore} from "anbaric-impl-cloud";
import {InMemorySecretStore} from "../src/InMemorySecretStore";
import {SecretStoreFactory} from "../src/SecretStoreFactory";

describe("SecretStoreFactory", () => {

    let originalStoreType : string | undefined;

    beforeEach(() => {
        originalStoreType = process.env.ANBARIC_SECRET_STORE_TYPE;
    });

    afterEach(() => {
        if (originalStoreType === undefined) {
            delete process.env.ANBARIC_SECRET_STORE_TYPE;
        } else {
            process.env.ANBARIC_SECRET_STORE_TYPE = originalStoreType;
        }
    });

    it("defaults to the in-memory store when the env var is unset", () => {
        delete process.env.ANBARIC_SECRET_STORE_TYPE;

        expect(SecretStoreFactory.instance()).toBeInstanceOf(InMemorySecretStore);
    });

    it("returns the in-memory store for the memory type", () => {
        process.env.ANBARIC_SECRET_STORE_TYPE = "memory";

        expect(SecretStoreFactory.instance()).toBeInstanceOf(InMemorySecretStore);
    });

    it("returns the cloud store for the cloud type", () => {
        process.env.ANBARIC_SECRET_STORE_TYPE = "cloud";

        expect(SecretStoreFactory.instance()).toBeInstanceOf(CloudSecretStore);
    });

    it("returns a fresh store per call", () => {
        expect(SecretStoreFactory.instance()).not.toBe(SecretStoreFactory.instance());
    });

});
