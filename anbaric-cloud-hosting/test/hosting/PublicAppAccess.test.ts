import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {createServer, IncomingMessage, Server, ServerResponse} from "node:http";
import {AddressInfo} from "node:net";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {BuildLayer} from "../../src/app-management/BuildLayer";
import {Authenticator} from "../../src/auth/Authenticator";
import {InMemoryMembershipService} from "../../src/auth/InMemoryMembershipService";
import {SessionSigner} from "../../src/auth/SessionSigner";
import {Tenant} from "../../src/auth/Tenant";
import {User} from "../../src/auth/User";
import {InMemoryAppSettingsStore} from "../../src/data-store/InMemoryAppSettingsStore";
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

/* An identity cookie of "id:<user>" proves who someone is; anything else is
   sent to the identity provider, which names where it would return them. */
class StubAuthenticator extends Authenticator {

    async authenticate(session : string | undefined, request : IncomingMessage, response : ServerResponse) : Promise<[User, Tenant] | undefined> {
        const known = await this.identify(session, request);
        if (known) return known;
        response.writeHead(302, { location: `https://idp.example/authorize?state=${encodeURIComponent(request.url ?? "")}` });
        response.end();
        return undefined;
    }

    async identify(session : string | undefined, _request : IncomingMessage) : Promise<[User, Tenant] | undefined> {
        return session?.startsWith("id:") ? [new User(session.slice(3)), new Tenant("acme")] : undefined;
    }

    redirectsToLoginOnFailure() : boolean {
        return true;
    }

}

const SECRET = "public-apps-secret";

const runningApp = (appName : string, appPort : number) : BuildLayer => ({
    ensureHydrated: async () => {},
    deploy: () => { throw new Error("not deployable in this test"); },
    status: (name) => name === appName
        ? { appName, status: "running", serving: true, appPort, appHost: "127.0.0.1", size: "small", log: [] }
        : undefined,
    list: () => [],
    resize: async () => undefined,
    ping: async () => true,
    logs: async function* () {},
    teardown: async () => undefined,
    consumerUrlFor: () => undefined,
    consumerUrlsFor: async () => [],
    appRemoved: () => {},
    regenerateDocs: async () => 0,
    cleanUp: async () => {},
});

describe("public apps", () => {

    let upstream : Server;
    let received : Array<{ method : string, url : string, cookie? : string }>;
    let settings : InMemoryAppSettingsStore;
    let server : HostingServer;
    let baseUrl : string;

    beforeEach(async () => {
        process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET;
        received = [];
        upstream = createServer((request, response) => {
            received.push({ method: request.method!, url: request.url!, cookie: request.headers.cookie });
            response.end("from the app");
        });
        await new Promise<void>(resolve => upstream.listen(0, resolve));

        const memberships = new InMemoryMembershipService();
        memberships.add("builder", "BUILDER");
        memberships.add("reader", "USER");
        settings = new InMemoryAppSettingsStore();
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined,
            runningApp("shop", (upstream.address() as AddressInfo).port),
            undefined, undefined, new StubAuthenticator(), undefined, undefined, "acme",
            undefined, [], undefined, undefined, undefined, undefined, memberships,
            undefined, undefined, undefined, undefined, settings);
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    });

    afterEach(async () => {
        delete process.env.ANBARIC_SESSION_SIGNING_SECRET;
        await server.close();
        await new Promise<void>(resolve => upstream.close(() => resolve()));
    });

    const sessionOf = (id : string) => new SessionSigner(SECRET).mint(new User(id), new Tenant("acme"));

    const visit = (path : string, headers : Record<string, string> = {}, method = "GET") =>
        fetch(`${baseUrl}${path}`, { method, headers, redirect: "manual" });

    const sessionUserOf = (cookie? : string) => {
        const session = cookie?.match(/anbaric_session=([^;]+)/)?.[1];
        return new SessionSigner(SECRET).verify(session)?.[0].id;
    };

    it("sends an anonymous visitor to a private app to sign in", async () => {
        const response = await visit("/app/shop/");

        expect(response.status).toBe(302);
        expect(received).toEqual([]);
    });

    it("serves an anonymous visitor to a public app, handing it no session", async () => {
        await settings.set("shop", { public: true });

        const response = await visit("/app/shop/basket", { cookie: "theirs=1" });

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("from the app");
        expect(received[0]).toMatchObject({ url: "/basket", cookie: "theirs=1" });
    });

    it("lets an anonymous visitor post to a public app", async () => {
        await settings.set("shop", { public: true });

        const response = await visit("/app/shop/orders", {}, "POST");

        expect(response.status).toBe(200);
        expect(received[0]).toMatchObject({ method: "POST", url: "/orders" });
    });

    it("serves a public app at its own hostname to an anonymous visitor", async () => {
        await settings.set("shop", { public: true });

        const response = await visit("/basket", { "x-anbaric-app-host": "shop" });

        expect(response.status).toBe(200);
        expect(received[0].url).toBe("/basket");
    });

    it("hands a public app the member's verified session, so their entitlements still apply", async () => {
        await settings.set("shop", { public: true });

        await visit("/app/shop/", { cookie: `anbaric_session=${sessionOf("reader")}` });

        expect(sessionUserOf(received[0].cookie)).toBe("reader");
    });

    it("recognises a member from the identity cookie alone and gives them a session", async () => {
        await settings.set("shop", { public: true });

        const response = await visit("/app/shop/", { cookie: "anbaric_central_session=id:reader" });

        expect(response.status).toBe(200);
        expect(sessionUserOf(received[0].cookie)).toBe("reader");
        expect(received[0].cookie).not.toContain("anbaric_central_session");
        expect(response.headers.get("set-cookie")).toContain("anbaric_session=");
    });

    it("treats someone signed in who belongs to another tenant as anonymous, passing on nothing of theirs", async () => {
        await settings.set("shop", { public: true });

        const response = await visit("/app/shop/", { cookie: "anbaric_central_session=id:stranger; anbaric_session=elsewhere" });

        expect(response.status).toBe(200);
        expect(received[0].cookie).toBeUndefined();
        expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("keeps the platform's own API closed to anonymous visitors when an app is public", async () => {
        await settings.set("shop", { public: true });

        expect((await visit("/api/v2/apps")).status).toBe(302);
        expect((await visit("/login", { "x-anbaric-app-host": "other" })).status).toBe(302);
    });

    it("signs a visitor in from an app's hostname and returns them to the page that linked there", async () => {
        const response = await visit("/login", { "x-anbaric-app-host": "shop", referer: `${baseUrl}/basket?item=2` });

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe(`https://idp.example/authorize?state=${encodeURIComponent("/basket?item=2")}`);
    });

    it("returns to the app's home when the link to sign in came from another host", async () => {
        const response = await visit("/login", { "x-anbaric-app-host": "shop", referer: "https://evil.example/basket" });

        expect(response.headers.get("location")).toBe(`https://idp.example/authorize?state=${encodeURIComponent("/")}`);
    });

    it("never returns anyone to another host by way of a path that starts with two slashes", async () => {
        const response = await visit("/login", { "x-anbaric-app-host": "shop", referer: `${baseUrl}//evil.example/basket` });

        expect(response.headers.get("location")).toBe(`https://idp.example/authorize?state=${encodeURIComponent("/")}`);
    });

    it("sends someone already signed in straight back from the app's sign-in link", async () => {
        const response = await visit("/login",
            { "x-anbaric-app-host": "shop", referer: `${baseUrl}/basket`, cookie: "anbaric_central_session=id:reader" });

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe("/basket");
    });

    describe("the public switch", () => {

        const turn = (id : string, on : unknown) =>
            fetch(`${baseUrl}/api/v2/apps/shop/public`, {
                method: "PUT",
                headers: { "content-type": "application/json", cookie: `anbaric_session=${sessionOf(id)}` },
                body: JSON.stringify({ on }),
            });

        it("lets a builder make an app public and shows it on the app", async () => {
            const response = await turn("builder", true);

            expect(await response.json()).toEqual({ appName: "shop", public: true });
            expect((await settings.get("shop")).public).toBe(true);
            const app = await (await fetch(`${baseUrl}/api/v2/apps/shop`, { headers: { cookie: `anbaric_session=${sessionOf("builder")}` } })).json();
            expect(app.public).toBe(true);
        });

        it("refuses a member who cannot build", async () => {
            expect((await turn("reader", true)).status).toBe(403);
            expect((await settings.get("shop")).public).toBe(false);
        });

        it("refuses anything but a boolean", async () => {
            expect((await turn("builder", "yes")).status).toBe(400);
        });

    });

});
