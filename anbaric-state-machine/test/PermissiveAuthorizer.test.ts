import {describe, expect, it} from "vitest";
import {PermissiveAuthorizer} from "../src/entitlements/PermissiveAuthorizer.js";

describe("PermissiveAuthorizer", () => {

    it("grants every check, registered or not", async () => {
        const authorizer = new PermissiveAuthorizer();

        expect(await authorizer.has("crm", "ada", "access")).toBe(true);
        expect(await authorizer.has("crm", "nobody", "never-registered")).toBe(true);
    });

    it("remembers what the app registered", async () => {
        const authorizer = new PermissiveAuthorizer();

        await authorizer.register("crm", "access", "Can use the app");
        await authorizer.register("crm", "export");

        expect(authorizer.registered).toEqual(["crm/access", "crm/export"]);
    });

});
