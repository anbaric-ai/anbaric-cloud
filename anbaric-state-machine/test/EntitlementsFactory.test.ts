import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {CloudEntitlements} from "anbaric-impl-cloud";
import {EntitlementsFactory} from "../src/entitlements/EntitlementsFactory.js";
import {PermissiveAuthorizer} from "../src/entitlements/PermissiveAuthorizer.js";

describe("EntitlementsFactory", () => {

    let originalType : string | undefined;

    beforeEach(() => {
        originalType = process.env.ANBARIC_ENTITLEMENTS_TYPE;
    });

    afterEach(() => {
        if (originalType === undefined) {
            delete process.env.ANBARIC_ENTITLEMENTS_TYPE;
        } else {
            process.env.ANBARIC_ENTITLEMENTS_TYPE = originalType;
        }
    });

    it("defaults to the permissive authorizer when the env var is unset", () => {
        delete process.env.ANBARIC_ENTITLEMENTS_TYPE;

        expect(EntitlementsFactory.instance()).toBeInstanceOf(PermissiveAuthorizer);
    });

    it("returns the permissive authorizer for the permissive type", () => {
        process.env.ANBARIC_ENTITLEMENTS_TYPE = "permissive";

        expect(EntitlementsFactory.instance()).toBeInstanceOf(PermissiveAuthorizer);
    });

    it("returns the cloud client for the cloud type", () => {
        process.env.ANBARIC_ENTITLEMENTS_TYPE = "cloud";

        expect(EntitlementsFactory.instance()).toBeInstanceOf(CloudEntitlements);
    });

});
