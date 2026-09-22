import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {CloudPromptManager} from "anbaric-impl-cloud";
import {InMemoryPromptManager} from "../src/InMemoryPromptManager.js";
import {PromptManagerFactory} from "../src/PromptManagerFactory.js";

describe("PromptManagerFactory", () => {

    let originalType : string | undefined;

    beforeEach(() => {
        originalType = process.env.ANBARIC_PROMPT_MANAGER_TYPE;
    });

    afterEach(() => {
        if (originalType === undefined) {
            delete process.env.ANBARIC_PROMPT_MANAGER_TYPE;
        } else {
            process.env.ANBARIC_PROMPT_MANAGER_TYPE = originalType;
        }
    });

    it("defaults to the in-memory manager when the env var is unset", () => {
        delete process.env.ANBARIC_PROMPT_MANAGER_TYPE;

        expect(PromptManagerFactory.instance()).toBeInstanceOf(InMemoryPromptManager);
    });

    it("returns the in-memory manager for the memory type", () => {
        process.env.ANBARIC_PROMPT_MANAGER_TYPE = "memory";

        expect(PromptManagerFactory.instance()).toBeInstanceOf(InMemoryPromptManager);
    });

    it("returns the cloud client for the cloud type", () => {
        process.env.ANBARIC_PROMPT_MANAGER_TYPE = "cloud";

        expect(PromptManagerFactory.instance()).toBeInstanceOf(CloudPromptManager);
    });

});
