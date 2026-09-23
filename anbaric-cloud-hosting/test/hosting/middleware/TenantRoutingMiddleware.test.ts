import {describe, expect, it, vi} from "vitest";
import {TenantRoutingMiddleware} from "../../../src/hosting/middleware/TenantRoutingMiddleware";
import {Request} from "../../../src/hosting/Request";

const asking = (claimed? : string) => {
    const replies : Array<{ status : number, body? : unknown }> = [];
    const request = {
        header: vi.fn((name : string) => name === "x-anbaric-tenant" ? claimed : undefined),
        reply: vi.fn((status : number, body? : unknown) => { replies.push({ status, body }); }),
    } as unknown as Request;
    return { request, replies };
};

describe("TenantRoutingMiddleware", () => {

    it("passes a request that names the tenant it reached", async () => {
        const { request, replies } = asking("acme");

        expect(await new TenantRoutingMiddleware("acme").apply(request)).toBe(true);
        expect(replies).toEqual([]);
    });

    it("passes a request that names no tenant at all", async () => {
        const { request, replies } = asking(undefined);

        expect(await new TenantRoutingMiddleware("acme").apply(request)).toBe(true);
        expect(replies).toEqual([]);
    });

    it("refuses a request routed to the wrong tenant, naming the one it asked for", async () => {
        const { request, replies } = asking("someone-else");

        expect(await new TenantRoutingMiddleware("acme").apply(request)).toBe(false);
        expect(replies[0].status).toBe(421);
        expect(JSON.stringify(replies[0].body)).toContain("someone-else");
    });

    it("refuses nothing when the platform has no tenant of its own", async () => {
        const { request, replies } = asking("acme");

        expect(await new TenantRoutingMiddleware(undefined).apply(request)).toBe(true);
        expect(replies).toEqual([]);
    });

    it("ignores surrounding whitespace rather than reading it as a different tenant", async () => {
        const { request, replies } = asking("  acme  ");

        expect(await new TenantRoutingMiddleware("acme").apply(request)).toBe(true);
        expect(replies).toEqual([]);
    });

});
