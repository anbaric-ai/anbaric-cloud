import {describe, expect, it} from "vitest";
import {AppLinkFallbackHandler} from "../../src/hosting/handlers/AppLinkFallbackHandler";
import {Request} from "../../src/hosting/Request";

const fakeRequest = (url : string, headers : Record<string, string> = {}) => {
    const written : { status? : number, headers? : any, body? : string, ended? : boolean } = {};
    const response = {
        setHeader: () => {},
        writeHead: (status : number, hdrs? : any) => { written.status = status; written.headers = hdrs; },
        end: (body? : string) => { written.body = body; written.ended = true; },
        get writableEnded() { return written.ended === true; },
    } as any;
    return { request: new Request({ url, headers, method: "GET" } as any, response), written };
};

describe("AppLinkFallbackHandler", () => {

    const handler = new AppLinkFallbackHandler();

    it("redirects an app-internal absolute link to its app with a 307", async () => {
        const { request, written } = fakeRequest("/orders?page=2", { referer: "https://platform.example/app/crm/dashboard" });

        await handler.handle(request);

        expect(written.status).toBe(307);
        expect(written.headers.location).toBe("/app/crm/orders?page=2");
        expect(written.headers["cache-control"]).toBe("no-store");
        expect(written.headers["vary"]).toBe("Referer");
    });

    it("404s a genuinely unrouted path with no app Referer", async () => {
        const { request, written } = fakeRequest("/nope");

        await handler.handle(request);

        expect(written.status).toBe(404);
    });

});
