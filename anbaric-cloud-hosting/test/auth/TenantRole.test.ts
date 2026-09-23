import {describe, expect, it} from "vitest";
import {canBuild, canInvite, deniesBuild, isTenantRole, TENANT_ROLES} from "../../src/auth/TenantRole";

describe("tenant roles", () => {

    it("recognises only the four roles", () => {
        for (const role of TENANT_ROLES) expect(isTenantRole(role)).toBe(true);
        for (const other of ["member", "owner", "SUPERUSER", "", undefined, 3]) {
            expect(isTenantRole(other)).toBe(false);
        }
    });

    it("lets an owner or admin invite, and nobody else", () => {
        expect(TENANT_ROLES.filter(canInvite)).toEqual(["OWNER", "ADMIN"]);
        expect(canInvite(undefined)).toBe(false);
    });

    it("lets everyone but a plain user build", () => {
        expect(TENANT_ROLES.filter(canBuild)).toEqual(["OWNER", "ADMIN", "BUILDER"]);
        expect(canBuild(undefined)).toBe(false);
    });

    // A platform with no membership service resolves no role at all, and there
    // nothing is refused - that is what keeps a local install working.
    it("refuses a build only for a role that is known and too low", () => {
        expect(deniesBuild("USER")).toBe(true);
        expect(deniesBuild("BUILDER")).toBe(false);
        expect(deniesBuild(undefined)).toBe(false);
    });

});
