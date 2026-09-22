import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Authenticator} from "../../src/auth/Authenticator";
import {InMemoryUserDirectory} from "../../src/auth/InMemoryUserDirectory";
import {SessionSigner} from "../../src/auth/SessionSigner";
import {Tenant} from "../../src/auth/Tenant";
import {TokenAuthenticator} from "../../src/auth/TokenAuthenticator";
import {User} from "../../src/auth/User";
import {UserDirectory} from "../../src/auth/UserDirectory";
import {AuthenticationMiddleware} from "../../src/hosting/middleware/AuthenticationMiddleware";
import {Request} from "../../src/hosting/Request";

const fakeRequest = (session? : string) => {
    const headers : Record<string, any> = {};
    return {
        session,
        method: "GET",
        raw: { headers: {}, method: "GET" },
        rawResponse: { getHeader: (name : string) => headers[name], setHeader: (name : string, value : any) => { headers[name] = value; } },
        handled: false,
        user: undefined,
        tenant: undefined,
    } as unknown as Request;
};

const loginAuthenticator = (user : User) => ({
    authenticate: vi.fn(async () => [user, new Tenant("acme")] as [User, Tenant]),
    authorize: vi.fn(async () => true),
    redirectsToLoginOnFailure: () => false,
}) as unknown as Authenticator;

const spyDirectory = (fail = false) => ({
    record: vi.fn(async (_user : User) => { if (fail) throw new Error("db down"); }),
    list: vi.fn(async () => []),
}) satisfies UserDirectory;

describe("AuthenticationMiddleware user directory", () => {

    const signer = new SessionSigner("directory-secret");
    const ada = new User("ada", [], [], "Ada Lovelace", undefined, "ada@example.com");

    beforeEach(() => vi.useFakeTimers());

    afterEach(() => vi.useRealTimers());

    it("records the user behind a valid session cookie", async () => {
        const directory = spyDirectory();
        const middleware = new AuthenticationMiddleware(undefined, undefined, () => false, signer, directory);

        await middleware.apply(fakeRequest(signer.mint(ada, new Tenant("acme"))));

        expect(directory.record).toHaveBeenCalledOnce();
        expect(directory.record.mock.calls[0][0].id).toBe("ada");
        expect(directory.record.mock.calls[0][0].name).toBe("Ada Lovelace");
    });

    it("records the user on a fresh authenticator login", async () => {
        const directory = spyDirectory();
        const middleware = new AuthenticationMiddleware(loginAuthenticator(ada), undefined, () => false, signer, directory);

        await middleware.apply(fakeRequest(undefined));

        expect(directory.record).toHaveBeenCalledOnce();
    });

    it("records each user at most once an hour", async () => {
        const directory = spyDirectory();
        const middleware = new AuthenticationMiddleware(undefined, undefined, () => false, signer, directory);
        const token = signer.mint(ada, new Tenant("acme"));

        await middleware.apply(fakeRequest(token));
        await middleware.apply(fakeRequest(token));
        vi.advanceTimersByTime(61 * 60 * 1000);
        await middleware.apply(fakeRequest(token));

        expect(directory.record).toHaveBeenCalledTimes(2);
    });

    it("does not record bearer-token callers, which carry no profile", async () => {
        const directory = spyDirectory();
        const tokens = {
            handles: () => true,
            authenticate: vi.fn(async () => new User("cli-user")),
        } as unknown as TokenAuthenticator;
        const middleware = new AuthenticationMiddleware(undefined, tokens, () => false, signer, directory);

        expect(await middleware.apply(fakeRequest(undefined))).toBe(true);
        expect(directory.record).not.toHaveBeenCalled();
    });

    it("still authenticates when the directory write fails, and retries next time", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const directory = spyDirectory(true);
        const middleware = new AuthenticationMiddleware(undefined, undefined, () => false, signer, directory);
        const token = signer.mint(ada, new Tenant("acme"));

        expect(await middleware.apply(fakeRequest(token))).toBe(true);
        expect(await middleware.apply(fakeRequest(token))).toBe(true);

        expect(directory.record).toHaveBeenCalledTimes(2);
    });

    it("keeps a real directory in step with the latest profile", async () => {
        const directory = new InMemoryUserDirectory();
        const middleware = new AuthenticationMiddleware(undefined, undefined, () => false, signer, directory);

        await middleware.apply(fakeRequest(signer.mint(ada, new Tenant("acme"))));

        expect((await directory.list()).map(user => [user.id, user.name, user.email])).toEqual([["ada", "Ada Lovelace", "ada@example.com"]]);
    });

});
