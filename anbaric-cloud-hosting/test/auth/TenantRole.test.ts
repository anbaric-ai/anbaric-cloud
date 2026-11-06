import {describe, expect, it} from "vitest";
import {canAssign, canBuild, canInvite, deniesBuild, isSuperAdmin, isTenantRole, TENANT_ROLES} from "../../src/auth/TenantRole";

describe("tenant roles", () => {

    it("recognises only the five roles", () => {
        expect(TENANT_ROLES).toEqual(["SUPER_ADMIN", "OWNER", "ADMIN", "BUILDER", "USER"]);
        for (const role of TENANT_ROLES) expect(isTenantRole(role)).toBe(true);
        for (const other of ["member", "owner", "SUPERUSER", "", undefined, 3]) {
            expect(isTenantRole(other)).toBe(false);
        }
    });

    it("lets a super-admin, owner or admin invite, and nobody else", () => {
        expect(TENANT_ROLES.filter(canInvite)).toEqual(["SUPER_ADMIN", "OWNER", "ADMIN"]);
        expect(canInvite(undefined)).toBe(false);
    });

    it("lets everyone but a plain user build", () => {
        expect(TENANT_ROLES.filter(canBuild)).toEqual(["SUPER_ADMIN", "OWNER", "ADMIN", "BUILDER"]);
        expect(canBuild(undefined)).toBe(false);
    });

    it("lets only a super-admin make an owner, and nobody make a super-admin", () => {
        expect(canAssign("OWNER", "SUPER_ADMIN")).toBe(true);
        expect(canAssign("OWNER", "OWNER")).toBe(false);
        expect(canAssign("BUILDER", "ADMIN")).toBe(true);
        for (const by of TENANT_ROLES) expect(canAssign("SUPER_ADMIN", by)).toBe(false);
        expect(TENANT_ROLES.filter(isSuperAdmin)).toEqual(["SUPER_ADMIN"]);
    });

    // A platform with no membership service resolves no role at all, and there
    // nothing is refused - that is what keeps a local install working.
    it("refuses a build only for a role that is known and too low", () => {
        expect(deniesBuild("USER")).toBe(true);
        expect(deniesBuild("BUILDER")).toBe(false);
        expect(deniesBuild(undefined)).toBe(false);
    });

});
