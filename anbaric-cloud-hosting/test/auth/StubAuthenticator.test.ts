import {afterEach, describe, expect, it} from "vitest";
import {IncomingMessage, ServerResponse} from "node:http";
import {StubAuthenticator} from "../../src/auth/StubAuthenticator";

const request = { url: "/jobs" } as IncomingMessage;
const response = {} as ServerResponse;

describe("StubAuthenticator", () => {

    afterEach(() => {
        delete process.env.ANBARIC_STUB_USER;
        delete process.env.ANBARIC_TENANT;
    });

    it("authenticates every request as the default local identity", async () => {
        const [user, tenant] = (await new StubAuthenticator().authenticate(undefined, request, response))!;

        expect(user.id).toBe("local-admin");
        expect(tenant.id).toBe("local");
    });

    it("takes its identity from the environment", async () => {
        process.env.ANBARIC_STUB_USER = "chris";
        process.env.ANBARIC_TENANT = "internal";

        const [user, tenant] = (await new StubAuthenticator().authenticate(undefined, request, response))!;

        expect(user.id).toBe("chris");
        expect(tenant.id).toBe("internal");
    });

    it("authorizes every request by default", async () => {
        const authenticator = new StubAuthenticator();
        const [user] = (await authenticator.authenticate("anything", request, response))!;

        expect(await authenticator.authorize(user, request, response)).toBe(true);
    });

});
