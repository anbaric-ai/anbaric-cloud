import {describe, expect, it, vi} from "vitest";
import {CentralBilling} from "../../src/billing/CentralBilling";

const answering = (status : number, body : unknown) =>
    vi.fn(async (_url : string, _init : RequestInit) => ({
        ok: status < 400,
        status,
        json: async () => body,
    }) as Response);

const billing = (fetchFn : ReturnType<typeof answering>) =>
    new CentralBilling("https://central.example/", "central-secret", "acme", fetchFn);

describe("CentralBilling", () => {

    it("asks central for the tenant's usage summary with the key", async () => {
        const fetchFn = answering(200, { currency: "GBP", appsToday: 2 });

        expect(await billing(fetchFn).summary()).toEqual({ currency: "GBP", appsToday: 2 });

        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe("https://central.example/usage/acme");
        expect(init.method).toBe("GET");
        expect((init.headers as Record<string, string>)["x-anbaric-central-key"]).toBe("central-secret");
    });

    it("asks central for a billing portal, saying where to come back to", async () => {
        const fetchFn = answering(200, { url: "https://billing.stripe.com/p/xyz" });

        expect(await billing(fetchFn).portalUrl("https://cloud.example/costs")).toBe("https://billing.stripe.com/p/xyz");

        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe("https://central.example/tenants/acme/billing/portal");
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body))).toEqual({ returnUrl: "https://cloud.example/costs" });
    });

    it("asks central to end the tenant, naming who asked", async () => {
        const fetchFn = answering(202, { slug: "acme" });

        await billing(fetchFn).terminate("auth0|ada");

        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe("https://central.example/tenants/acme");
        expect(init.method).toBe("DELETE");
        expect((init.headers as Record<string, string>)["x-anbaric-user"]).toBe("auth0|ada");
    });

    it("passes central's explanation on when it refuses", async () => {
        await expect(billing(answering(409, { error: "This tenant has no payment details to update" })).portalUrl("https://cloud.example/"))
            .rejects.toThrow("no payment details");
    });

});
