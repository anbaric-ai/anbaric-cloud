import {afterEach, beforeEach, describe, expect, it, Mock, vi} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {InMemoryMembershipService} from "../../src/auth/InMemoryMembershipService";
import {SessionSigner} from "../../src/auth/SessionSigner";
import {Tenant} from "../../src/auth/Tenant";
import {User} from "../../src/auth/User";
import {CentralBilling} from "../../src/billing/CentralBilling";
import {HostingServer} from "../../src/hosting/HostingServer";
import {RemoteQueue} from "../../src/queuing/RemoteQueue";

class ConfirmableInMemoryQueue extends InMemoryQueue implements RemoteQueue {

    async confirm(_message : QueueMessage) : Promise<void> {}

    async debounce(_message : QueueMessage) : Promise<void> {}

    async cancel(_message : QueueMessage) : Promise<void> {}

    async size() : Promise<number> {
        return 0;
    }

}

const SECRET = "billing-secret";

describe("the costs page's billing api", () => {

    let server : HostingServer;
    let baseUrl : string;
    let central : Mock<(url : string, init : RequestInit) => Promise<Response>>;

    beforeEach(async () => {
        process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET;
        process.env.ANBARIC_PLATFORM_PUBLIC_URL = "https://cloud.example";
        const memberships = new InMemoryMembershipService();
        memberships.add("ada", "OWNER");
        memberships.add("bob", "BUILDER");
        memberships.add("fox", "USER");

        central = vi.fn(async (url : string, _init : RequestInit) => ({
            ok: true, status: 200,
            json: async () => url.endsWith("/billing/portal") ? { url: "https://billing.stripe.com/p/xyz" } : { currency: "USD", appsToday: 3 },
        }) as Response);

        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined, undefined,
            undefined, undefined, undefined, undefined, undefined, "acme", undefined, [], undefined, undefined,
            undefined, undefined, memberships, undefined, undefined, undefined,
            new CentralBilling("https://central.example", "central-secret", "acme", central));
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    });

    afterEach(async () => {
        delete process.env.ANBARIC_SESSION_SIGNING_SECRET;
        delete process.env.ANBARIC_PLATFORM_PUBLIC_URL;
        await server.close();
    });

    const as = (id : string) =>
        `anbaric_session=${new SessionSigner(SECRET).mint(new User(id), new Tenant("acme"))}`;

    const summary = (who : string) =>
        fetch(`${baseUrl}/api/v2/billing/summary`, { headers: { cookie: as(who) } });

    const portal = (who : string, body : unknown = { returnTo: "/costs" }) =>
        fetch(`${baseUrl}/api/v2/billing/portal`, {
            method: "POST", headers: { cookie: as(who), "content-type": "application/json" }, body: JSON.stringify(body),
        });

    it("gives a builder the tenant's costs as central reports them", async () => {
        const response = await summary("bob");

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ currency: "USD", appsToday: 3 });
        expect(central.mock.calls[0][0]).toBe("https://central.example/usage/acme");
    });

    it("keeps the costs from someone who only uses the apps", async () => {
        expect((await summary("fox")).status).toBe(403);
        expect(central).not.toHaveBeenCalled();
    });

    it("sends an owner to the payment portal, returning to the console page they left", async () => {
        const response = await portal("ada");

        expect(response.status).toBe(200);
        expect((await response.json()).url).toBe("https://billing.stripe.com/p/xyz");
        expect(JSON.parse(String(central.mock.calls[0][1].body))).toEqual({ returnUrl: "https://cloud.example/costs" });
    });

    it("only ever returns to a path on the console, whatever the page asked for", async () => {
        await portal("ada", { returnTo: "https://evil.example/" });

        expect(JSON.parse(String(central.mock.calls[0][1].body))).toEqual({ returnUrl: "https://cloud.example/" });
    });

    it("refuses a builder the payment details", async () => {
        expect((await portal("bob")).status).toBe(403);
        expect(central).not.toHaveBeenCalled();
    });

    it("explains when the tenant has no payment details to change", async () => {
        central.mockImplementation(async () => ({
            ok: false, status: 409, json: async () => ({ error: "This tenant has no payment details to update" }),
        }) as Response);

        const response = await portal("ada");

        expect(response.status).toBe(409);
        expect((await response.json()).error).toContain("no payment details");
    });

});
