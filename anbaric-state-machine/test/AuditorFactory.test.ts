import {afterEach, describe, expect, it} from "vitest";
import {CloudAuditor} from "anbaric-impl-cloud";
import {AuditorFactory} from "../src/auditing/AuditorFactory.js";
import {ConsoleAuditor} from "../src/auditing/ConsoleAuditor.js";

describe("AuditorFactory", () => {

    afterEach(() => {
        delete process.env.ANBARIC_AUDITOR_TYPE;
    });

    it("defaults to the console auditor", () => {
        expect(AuditorFactory.instance()).toBeInstanceOf(ConsoleAuditor);
    });

    it("provides the cloud auditor in cloud mode", () => {
        process.env.ANBARIC_AUDITOR_TYPE = "cloud";

        expect(AuditorFactory.instance()).toBeInstanceOf(CloudAuditor);
    });

});
