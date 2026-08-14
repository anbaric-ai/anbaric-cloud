import {describe, expect, it} from "vitest";
import {loadAuthenticator} from "../../src/auth/AuthenticatorLoader";

describe("loadAuthenticator", () => {

    it("loads nothing when no module is configured", async () => {
        expect(await loadAuthenticator(undefined)).toBeUndefined();
        expect(await loadAuthenticator("")).toBeUndefined();
    });

    it("rejects a module without a createAuthenticator export", async () => {
        await expect(loadAuthenticator("anbaric-tsapi"))
            .rejects.toThrowError('Authenticator module "anbaric-tsapi" does not export a createAuthenticator function');
    });

});
