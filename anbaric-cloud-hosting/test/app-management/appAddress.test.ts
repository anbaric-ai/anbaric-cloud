import {describe, expect, it} from "vitest";
import {appAddress} from "../../src/app-management/appAddress";

describe("appAddress", () => {

    it("serves an app at its own allocated address when it has one", () => {
        expect(appAddress("invoices", "acme-invoices", "cloud.anbaric.ai"))
            .toBe("https://acme-invoices.cloud.anbaric.ai");
    });

    /* A self-hoster who pointed their own wildcard at the platform has no
       control plane to allocate anything, and one platform serves one tenant
       there - so the app's own name is unambiguous. */
    it("falls back to the app's name under the host suffix", () => {
        expect(appAddress("invoices", undefined, "apps.example.com"))
            .toBe("https://invoices.apps.example.com");
    });

    it("serves by path where there is no domain for apps at all", () => {
        expect(appAddress("invoices", undefined, "")).toBe("/app/invoices");
        expect(appAddress("invoices", "acme-invoices", "")).toBe("/app/invoices");
    });

});
