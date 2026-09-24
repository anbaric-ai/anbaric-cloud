import {describe, expect, it} from "vitest";
import {hostLabelFor, hostnameObjection, LABEL_LIMIT} from "../../src/app-management/appHostname";

describe("appHostname", () => {

    it("puts the tenant in the name, so two tenants may both have a hello-world", () => {
        expect(hostLabelFor("hello-world", "dana-x")).toBe("hello-world--dana-x");
        expect(hostLabelFor("hello-world", "fox-y")).toBe("hello-world--fox-y");
    });

    it("accepts the ordinary kebab names apps actually have", () => {
        expect(hostnameObjection("news-sweep", "martyn-jobber-dc6e0a")).toBeUndefined();
        expect(hostnameObjection("crm", "acme")).toBeUndefined();
    });

    it("refuses a name that would make the separator ambiguous", () => {
        expect(hostnameObjection("hello--world", "dana-x")).toContain("cannot contain");
    });

    it("refuses anything that is not a hostname label", () => {
        expect(hostnameObjection("Hello", "dana-x")).toContain("lower-case");
        expect(hostnameObjection("hello world", "dana-x")).toContain("lower-case");
        expect(hostnameObjection("-hello", "dana-x")).toContain("lower-case");
        expect(hostnameObjection("hello_world", "dana-x")).toContain("lower-case");
    });

    it("refuses a name that would not fit in a hostname label with its tenant", () => {
        const tenant = "a".repeat(30);
        const objection = hostnameObjection("b".repeat(40), tenant);

        expect(objection).toContain(String(LABEL_LIMIT));
        expect(hostLabelFor("b".repeat(40), tenant).length).toBeGreaterThan(LABEL_LIMIT);
    });

    it("judges only the name when there is no tenant to fit alongside", () => {
        expect(hostnameObjection("b".repeat(70), "")).toBeUndefined();
        expect(hostnameObjection("Nope", "")).toContain("lower-case");
    });

});
