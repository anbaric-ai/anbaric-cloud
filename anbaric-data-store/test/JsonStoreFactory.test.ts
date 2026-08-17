import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {CloudJsonStore} from "anbaric-impl-cloud";
import {InMemoryJsonStore} from "../src/InMemoryJsonStore";
import {JsonStoreFactory} from "../src/JsonStoreFactory";

describe("JsonStoreFactory", () => {

    let originalStoreType : string | undefined;

    beforeEach(() => {
        originalStoreType = process.env.ANBARIC_JSON_STORE_TYPE;
    });

    afterEach(() => {
        if (originalStoreType === undefined) {
            delete process.env.ANBARIC_JSON_STORE_TYPE;
        } else {
            process.env.ANBARIC_JSON_STORE_TYPE = originalStoreType;
        }
    });

    it("defaults to the in-memory store when the env var is unset", () => {
        delete process.env.ANBARIC_JSON_STORE_TYPE;

        expect(JsonStoreFactory.instance("customers")).toBeInstanceOf(InMemoryJsonStore);
    });

    it("returns the in-memory store for the memory type", () => {
        process.env.ANBARIC_JSON_STORE_TYPE = "memory";

        expect(JsonStoreFactory.instance("customers")).toBeInstanceOf(InMemoryJsonStore);
    });

    it("returns the cloud store for the cloud type", () => {
        process.env.ANBARIC_JSON_STORE_TYPE = "cloud";

        expect(JsonStoreFactory.instance("customers")).toBeInstanceOf(CloudJsonStore);
    });

    it("returns a fresh store per call", () => {
        expect(JsonStoreFactory.instance("customers")).not.toBe(JsonStoreFactory.instance("customers"));
    });

});
