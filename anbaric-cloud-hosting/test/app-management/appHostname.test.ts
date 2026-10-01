import {describe, expect, it} from "vitest";
import {hostnameObjection, NAME_LIMIT} from "../../src/app-management/appHostname";

describe("appHostname", () => {

    it("accepts an ordinary app name", () => {
        expect(hostnameObjection("news-sweep")).toBeUndefined();
        expect(hostnameObjection("crm")).toBeUndefined();
        expect(hostnameObjection("app2")).toBeUndefined();
    });

    it("refuses anything that could not be a hostname label", () => {
        expect(hostnameObjection("Hello")).toContain("lower-case");
        expect(hostnameObjection("hello world")).toContain("lower-case");
        expect(hostnameObjection("-hello")).toContain("lower-case");
        expect(hostnameObjection("hello-")).toContain("lower-case");
        expect(hostnameObjection("hello_world")).toContain("lower-case");
    });

    /* A double hyphen used to separate the app from its tenant inside one
       label. Addresses are allocated now, so it is just a hyphen. */
    it("no longer objects to a double hyphen", () => {
        expect(hostnameObjection("hello--world")).toBeUndefined();
    });

    // Held short of the 63 a label allows, so the control plane can still fit
    // a distinguishing word beside a name two tenants both wanted.
    it("keeps a name short enough to have a word added to it", () => {
        expect(hostnameObjection("b".repeat(NAME_LIMIT))).toBeUndefined();
        expect(hostnameObjection("b".repeat(NAME_LIMIT + 1))).toContain("too long");
    });

});
