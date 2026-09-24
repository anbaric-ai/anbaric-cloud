import {describe, expect, it, vi} from "vitest";
import {AppHostMiddleware} from "../../../src/hosting/middleware/AppHostMiddleware";
import {AppProxyHandler} from "../../../src/hosting/handlers/AppProxyHandler";
import {Request} from "../../../src/hosting/Request";

const asking = (app : string | undefined, pathname : string = "/orders") => {
    const served : Array<string> = [];
    const proxy = { serveAtRoot: vi.fn(async (_request : Request, name : string) => { served.push(name); }) } as unknown as AppProxyHandler;
    const request = {
        header: vi.fn((name : string) => name === "x-anbaric-app-host" ? app : undefined),
        url: new URL(`http://x${pathname}`),
    } as unknown as Request;
    return { proxy, request, served };
};

describe("AppHostMiddleware", () => {

    it("serves the named app instead of anything the platform would route", async () => {
        const { proxy, request, served } = asking("news-sweep");

        expect(await new AppHostMiddleware(proxy).apply(request)).toBe(false);
        expect(served).toEqual(["news-sweep"]);
    });

    it("leaves an ordinary request to the platform alone", async () => {
        const { proxy, request, served } = asking(undefined);

        expect(await new AppHostMiddleware(proxy).apply(request)).toBe(true);
        expect(served).toEqual([]);
    });

    // Otherwise the redirect back from the identity provider is handed to the
    // app, which knows nothing about it, and nobody can ever sign in.
    it("keeps the sign-in round trip for the platform", async () => {
        for (const path of ["/login", "/callback", "/logout"]) {
            const { proxy, request, served } = asking("news-sweep", path);

            expect(await new AppHostMiddleware(proxy).apply(request)).toBe(true);
            expect(served).toEqual([]);
        }
    });

    it("does nothing at all on a platform that hosts no apps", async () => {
        const { request, served } = asking("news-sweep");

        expect(await new AppHostMiddleware(undefined).apply(request)).toBe(true);
        expect(served).toEqual([]);
    });

});
