import {describe, expect, it} from "vitest";
import * as anbaric from "../src/index";

describe("anbaric umbrella", () => {

    it("exposes the app-facing surface in one import", () => {
        expect(anbaric.StateMachine).toBeTypeOf("function");
        expect(anbaric.Job).toBeTypeOf("function");
        expect(anbaric.State).toBeTypeOf("function");
        expect(anbaric.Action).toBeTypeOf("function");
        expect(anbaric.Code).toBeTypeOf("function");
        expect(anbaric.Human).toBeTypeOf("function");
        expect(anbaric.InMemoryJobPersistence).toBeTypeOf("function");
        expect(anbaric.InMemoryJsonStore).toBeTypeOf("function");
        expect(anbaric.CloudJobPersistence).toBeTypeOf("function");
        expect(anbaric.JsonStoreFactory).toBeTypeOf("object");
    });

});
