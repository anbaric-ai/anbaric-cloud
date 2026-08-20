import {describe, expect, it} from "vitest";
import * as api from "../src/index";

describe("public api barrel", () => {

    it("exports all runtime classes", () => {
        expect(api.Job).toBeTypeOf("function");
        expect(api.PropertyDefinition).toBeTypeOf("function");
        expect(api.State).toBeTypeOf("function");
        expect(api.Terminal).toBeTypeOf("function");
        expect(api.Action).toBeTypeOf("function");
        expect(api.AgenticAction).toBeTypeOf("function");
        expect(api.Agent).toBeTypeOf("function");
        expect(api.Transition).toBeTypeOf("function");
    });

});
