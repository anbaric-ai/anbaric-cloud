import {describe, expect, it} from "vitest";
import {IncomingMessage, ServerResponse} from "node:http";
import {loadAuthenticator} from "../../src/auth/AuthenticatorLoader";
import {StubAuthenticator} from "../../src/auth/StubAuthenticator";

describe("loadAuthenticator", () => {

    it("loads nothing when no module is configured", async () => {
        expect(await loadAuthenticator(undefined)).toBeUndefined();
        expect(await loadAuthenticator("")).toBeUndefined();
    });

    it("provides the stub authenticator without a dynamic import", async () => {
        expect(await loadAuthenticator("stub")).toBeInstanceOf(StubAuthenticator);
    });

    it("rejects a module without a createAuthenticator export", async () => {
        await expect(loadAuthenticator("anbaric-tsapi"))
            .rejects.toThrowError('Authenticator module "anbaric-tsapi" does not export a createAuthenticator function');
    });

});
