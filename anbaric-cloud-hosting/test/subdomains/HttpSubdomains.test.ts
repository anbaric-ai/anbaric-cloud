import {afterEach, describe, expect, it, vi} from "vitest";
import {HttpSubdomains} from "../../src/subdomains/HttpSubdomains";

const answering = (status : number, body : unknown) =>
    vi.fn(async (_url : string, _init : RequestInit) => ({
        ok: status < 400,
        status,
        json: async () => body,
    }) as Response);

const subdomains = (fetchFn : ReturnType<typeof answering>) =>
    new HttpSubdomains("https://central.example", "central-secret", "acme", fetchFn);

describe("HttpSubdomains", () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("asks central for an address, with the tenant and the key", async () => {
        const fetchFn = answering(200, { appName: "invoices", subdomain: "invoices", published: true });

        expect(await subdomains(fetchFn).allocate("invoices")).toMatchObject({ subdomain: "invoices" });

        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe("https://central.example/tenants/acme/apps/invoices/subdomain");
        expect(init.method).toBe("POST");
        expect((init.headers as Record<string, string>)["x-anbaric-central-key"]).toBe("central-secret");
    });

    /* An app that is up and reachable by path should not be held back because
       its address could not be arranged; the next boot asks again. */
    it("reports no address rather than failing a deploy", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});

        expect(await subdomains(answering(500, { error: "boom" })).allocate("invoices")).toBeUndefined();
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("could not get an address"));
    });

    // Setting one is a person's deliberate act and they are waiting on the
    // answer, so a refusal is told to them rather than swallowed.
    it("throws when an address a person chose is refused", async () => {
        const fetchFn = answering(409, { error: '"orders" is already in use as an address' });

        await expect(subdomains(fetchFn).set("invoices", "orders")).rejects.toThrow("already in use");
    });

    it("sends the chosen address as the body", async () => {
        const fetchFn = answering(200, { appName: "invoices", subdomain: "orders", published: true });

        await subdomains(fetchFn).set("invoices", "orders");

        expect(JSON.parse(fetchFn.mock.calls[0][1].body as string)).toEqual({ subdomain: "orders" });
    });

    it("treats an address that was already gone as released", async () => {
        const fetchFn = answering(404, { error: "no address" });

        await expect(subdomains(fetchFn).release("invoices")).resolves.toBeUndefined();
    });

    it("holds the listing rather than asking central on every page load", async () => {
        const fetchFn = answering(200, [{ appName: "invoices", subdomain: "invoices", published: true }]);
        const client = subdomains(fetchFn);

        await client.all();
        await client.all();

        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it("asks again once it has changed something", async () => {
        const fetchFn = answering(200, [{ appName: "invoices", subdomain: "invoices", published: true }]);
        const client = subdomains(fetchFn);

        await client.all();
        await client.allocate("orders");
        await client.all();

        expect(fetchFn.mock.calls.filter(call => call[1].method === undefined || call[1].method === "GET")).toHaveLength(2);
    });

    it("answers with nothing rather than throwing when central cannot be reached", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) : Promise<Response> => {
            throw new Error("connect ECONNREFUSED");
        });

        expect(await subdomains(fetchFn).all()).toEqual([]);
    });

});
