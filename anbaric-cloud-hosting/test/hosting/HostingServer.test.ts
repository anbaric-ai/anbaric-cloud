import {generateKeyPairSync, sign} from "node:crypto";
import {get as httpGet} from "node:http";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {Job, JsonStore, QueueMessage} from "anbaric-tsapi";
import {CloudJobPersistence, CloudJsonStore, CloudQueue, CloudSecretStore} from "anbaric-impl-cloud";
import {Code, InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {InMemoryJsonStore, InMemorySecretStore} from "anbaric-data-store";
import {Authenticator} from "../../src/auth/Authenticator";
import {CliAuthorizer} from "../../src/auth/CliAuthorizer";
import {CliKey} from "../../src/auth/CliKey";
import {InMemoryCliKeyStore} from "../../src/auth/InMemoryCliKeyStore";
import {Role} from "../../src/auth/Role";
import {Tenant} from "../../src/auth/Tenant";
import {TokenAuthenticator} from "../../src/auth/TokenAuthenticator";
import {User} from "../../src/auth/User";
import {InMemoryAuditRecordStore} from "../../src/auditing/InMemoryAuditRecordStore";
import {RemoteQueue} from "../../src/queuing/RemoteQueue";
import {HostingServer} from "../../src/hosting/HostingServer";

const makeJob = (id : string, properties : Map<string, any> = new Map()) => new Job(id, properties, "start");
const actor = new Code("tester");

const rawGet = (url : string, headers : Record<string, string> = {}) =>
    new Promise<{ status : number, location? : string, cacheControl? : string, vary? : string }>((resolve, reject) => {
        httpGet(url, { headers }, (response) => {
            response.resume();
            resolve({
                status: response.statusCode ?? 0,
                location: response.headers.location,
                cacheControl: response.headers["cache-control"],
                vary: response.headers["vary"],
            });
        }).on("error", reject);
    });

class ConfirmableInMemoryQueue extends InMemoryQueue implements RemoteQueue {

    confirmed : Array<QueueMessage> = [];
    pendingSize = 0;

    async confirm(message : QueueMessage) : Promise<void> {
        this.confirmed.push(message);
    }

    async debounce(_message : QueueMessage) : Promise<void> {
    }

    async cancel(_message : QueueMessage) : Promise<void> {
    }

    async size() : Promise<number> {
        return this.pendingSize;
    }

}

describe("HostingServer round-trip via the cloud clients", () => {

    let server : HostingServer;
    let baseUrl : string;
    let persistence : CloudJobPersistence;
    let queue : CloudQueue;
    let backingQueue : ConfirmableInMemoryQueue;

    beforeEach(async () => {
        backingQueue = new ConfirmableInMemoryQueue();
        const documentStores = new Map<string, JsonStore>();
        const secretStores = new Map<string, InMemorySecretStore>();
        server = new HostingServer(new InMemoryJobPersistence(), backingQueue, undefined, undefined,
            (appId, collection) => {
                const key = `${appId}/${collection}`;
                if (!documentStores.has(key)) documentStores.set(key, new InMemoryJsonStore());
                return documentStores.get(key)!;
            },
            (appId) => secretStores.get(appId) ?? secretStores.set(appId, new InMemorySecretStore()).get(appId)!);
        const port = await server.listen(0);
        baseUrl = `http://127.0.0.1:${port}`;
        persistence = new CloudJobPersistence(baseUrl);
        queue = new CloudQueue(baseUrl);
    });

    afterEach(async () => {
        await server.close();
    });

    describe("app-internal link recovery", () => {

        it("redirects an unrouted absolute path carrying an app Referer back onto its app, uncacheably", async () => {
            const { status, location, cacheControl, vary } = await rawGet(`${baseUrl}/styles.css`, { referer: `${baseUrl}/app/crm/dashboard` });

            expect(status).toBe(307);
            expect(location).toBe("/app/crm/styles.css");
            // The mapping is Referer-dependent, so it must never be cached and served cross-app.
            expect(cacheControl).toBe("no-store");
            expect(vary).toBe("Referer");
        });

        it("still 404s an unrouted path with no app Referer", async () => {
            const { status } = await rawGet(`${baseUrl}/styles.css`);

            expect(status).toBe(404);
        });

    });

    describe("favicon", () => {

        it("serves the Anbaric ident as a PNG, cacheably", async () => {
            const response = await fetch(`${baseUrl}/favicon.ico`);

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe("image/png");
            expect(response.headers.get("cache-control")).toContain("max-age=");
            expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
        });

        // A deployed app that declares no icon falls back to the origin root,
        // so this one route covers every app the platform fronts.
        it("serves it without a session", async () => {
            const response = await fetch(`${baseUrl}/favicon.ico`);

            expect(response.status).toBe(200);
        });

    });

    describe("job persistence", () => {

        it("creates and retrieves a job", async () => {
            await persistence.create(actor, makeJob("job-1", new Map([["colour", "red"]])));

            const retrieved = await persistence.retrieve("job-1", actor);

            expect(retrieved.id).toBe("job-1");
            expect(retrieved.state).toBe("start");
            expect(retrieved.properties.get("colour")).toBe("red");
        });

        it("rejects retrieval of an unknown job", async () => {
            await expect(persistence.retrieve("missing", actor)).rejects.toThrowError('No job found with id "missing"');
        });

        it("merges properties into the persisted job on save", async () => {
            await persistence.create(actor, makeJob("job-1", new Map([["colour", "red"]])));
            const job = await persistence.retrieve("job-1", actor);

            await persistence.save(actor, "resized", job, new Map([["size", "large"]]));

            const updated = await persistence.retrieve("job-1", actor);
            expect(updated.properties.get("colour")).toBe("red");
            expect(updated.properties.get("size")).toBe("large");
        });

        it("deletes a job", async () => {
            await persistence.create(actor, makeJob("job-1"));

            await persistence.delete("job-1", actor);

            await expect(persistence.retrieve("job-1", actor)).rejects.toThrowError();
        });

        it("lists jobs with paging", async () => {
            for (const id of ["a", "b", "c"]) {
                await persistence.create(actor, makeJob(id));
            }

            expect((await persistence.list(actor)).map(job => job.id)).toEqual(["a", "b", "c"]);
            expect((await persistence.list(actor, 2, 1)).map(job => job.id)).toEqual(["c"]);
        });

    });

    describe("killing and stats", () => {

        it("kills a job through the cloud client", async () => {
            await persistence.create(actor, makeJob("job-1"));

            await persistence.kill("job-1", actor);

            expect((await persistence.retrieve("job-1", actor)).killed).toBe(true);
        });

        it("kills jobs older than a cutoff and reports how many", async () => {
            await persistence.create(actor, new Job("old", new Map(), "start", "wf", undefined, "system", new Date("2020-01-01"), new Date("2020-01-01")));
            await persistence.create(actor, makeJob("recent"));

            expect(await persistence.killOlderThan(new Date("2021-01-01"), actor)).toBe(1);
            expect((await persistence.retrieve("old", actor)).killed).toBe(true);
            expect((await persistence.retrieve("recent", actor)).killed).toBe(false);
        });

        it("counts jobs by state", async () => {
            await persistence.create(actor, makeJob("a"));
            await persistence.create(actor, makeJob("b"));

            expect(await persistence.countByState(actor)).toContainEqual({ state: "start", killed: false, count: 2 });
        });

        it("reports the queue size", async () => {
            backingQueue.pendingSize = 3;

            const response = await fetch(`${baseUrl}/api/v2/queue/size`);

            expect(await response.json()).toEqual({ size: 3 });
        });

    });

    describe("queue", () => {

        it("enqueues messages into the platform's queue in order", async () => {
            await queue.enqueue("job-1", undefined, "workflow-1");
            await queue.enqueue("job-2", undefined, "workflow-2");

            expect(await backingQueue.dequeueSome()).toEqual([
                { jobId: "job-1", workflowId: "workflow-1" },
                { jobId: "job-2", workflowId: "workflow-2" },
            ]);
        });

        it("schedules messages for later release", async () => {
            await queue.schedule("past-due", undefined, "workflow-1", new Date(Date.now() - 1000));
            await queue.schedule("future", undefined, "workflow-1", new Date(Date.now() + 60_000));

            expect(await backingQueue.dequeueSome()).toEqual([{ jobId: "past-due", workflowId: "workflow-1" }]);
        });

        it("passes confirm messages through to the backing queue", async () => {
            const response = await fetch(`${baseUrl}/api/v2/queue/confirm`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ jobId: "job-1", workflowId: "workflow-1" }),
            });

            expect(response.status).toBe(204);
            expect(backingQueue.confirmed).toEqual([{ jobId: "job-1", workflowId: "workflow-1" }]);
        });

    });

    describe("json documents", () => {

        const customerSchema = {
            type: "object" as const,
            required: ["name"],
            properties: { name: { type: "string" as const } },
        };

        it("round-trips documents through the cloud store", async () => {
            const store = new CloudJsonStore("customers", customerSchema, baseUrl);

            await store.create(actor, "ada", { name: "Ada" });

            expect(await store.retrieve("ada", actor)).toEqual({ name: "Ada" });
        });

        it("rejects an invalid document client-side before it reaches the platform", async () => {
            const store = new CloudJsonStore("customers", customerSchema, baseUrl);

            await expect(store.create(actor, "bad", { name: 7 })).rejects.toThrowError("failed schema validation");
            expect(await store.list(actor)).toEqual([]);
        });

        it("keeps collections separate", async () => {
            const customers = new CloudJsonStore("customers", customerSchema, baseUrl);
            const orders = new CloudJsonStore("orders", undefined, baseUrl);

            await customers.create(actor, "ada", { name: "Ada" });
            await orders.create(actor, "order-1", { total: 42 });

            expect(await customers.list(actor)).toEqual([{ name: "Ada" }]);
            expect(await orders.list(actor)).toEqual([{ total: 42 }]);
        });

        it("deletes documents and 404s unknown ids", async () => {
            const store = new CloudJsonStore("customers", customerSchema, baseUrl);
            await store.create(actor, "ada", { name: "Ada" });

            await store.delete("ada", actor);

            await expect(store.retrieve("ada", actor)).rejects.toThrowError('No document found with id "ada"');
        });

    });

    describe("secrets", () => {

        it("round-trips a secret through the cloud store", async () => {
            const secrets = new CloudSecretStore(baseUrl);

            await secrets.create(actor, "api-key", "s3cr3t");

            expect(await secrets.retrieve("api-key", actor)).toBe("s3cr3t");
        });

        it("lists secret names", async () => {
            const secrets = new CloudSecretStore(baseUrl);

            await secrets.create(actor, "api-key", "a");
            await secrets.create(actor, "db-password", "b");

            expect(await secrets.list(actor)).toEqual(["api-key", "db-password"]);
        });

        it("deletes secrets and 404s unknown names", async () => {
            const secrets = new CloudSecretStore(baseUrl);
            await secrets.create(actor, "api-key", "s3cr3t");

            await secrets.delete("api-key", actor);

            await expect(secrets.retrieve("api-key", actor)).rejects.toThrowError('No secret found with name "api-key"');
        });

        it("rejects a non-string secret value", async () => {
            const response = await fetch(`${baseUrl}/api/v2/secrets/api-key`, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ value: 42 }),
            });

            expect(response.status).toBe(400);
        });

    });

    it("lists registered state machines", async () => {
        await fetch(`${baseUrl}/api/v2/consumers`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ workflowId: "workflow-1", url: "http://app:8788" }),
        });

        const stateMachines = await (await fetch(`${baseUrl}/api/v2/state-machines`)).json();

        expect(stateMachines).toEqual([{ workflowId: "workflow-1", url: "http://app:8788" }]);
    });

    describe("authentication", () => {

        class StubAuthenticator extends Authenticator {

            async authenticate(session : string | undefined, _request : import("node:http").IncomingMessage,
                               response : import("node:http").ServerResponse) : Promise<[User, Tenant] | undefined> {
                if (session === "valid-session") return [new User("user-1", [new Role("admin")]), new Tenant("internal")];
                response.writeHead(302, { location: "https://login.example/authorize" });
                response.end();
                return undefined;
            }

        }

        class DenyingAuthenticator extends StubAuthenticator {

            async authorize() : Promise<boolean> {
                return false;
            }

        }

        class ProviderAuthenticator extends StubAuthenticator {

            logoutUrl() : string {
                return "https://login.example/v2/logout";
            }

        }

        let authenticatedServer : HostingServer;
        let authenticatedUrl : string;

        beforeEach(async () => {
            authenticatedServer = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(),
                undefined, undefined, undefined, undefined, new StubAuthenticator());
            authenticatedUrl = `http://127.0.0.1:${await authenticatedServer.listen(0)}`;
        });

        afterEach(async () => {
            await authenticatedServer.close();
        });

        // Browsers ask for it before anyone has signed in, so gating it behind
        // a session sends the icon request into the login flow instead.
        it("serves the favicon to an unauthenticated browser rather than redirecting", async () => {
            const response = await fetch(`${authenticatedUrl}/favicon.ico`, { redirect: "manual" });

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe("image/png");
        });

        it("signs out by expiring the session cookie and sending the browser home", async () => {
            const response = await fetch(`${authenticatedUrl}/logout`, {
                headers: { cookie: "anbaric_session=valid-session" },
                redirect: "manual",
            });

            expect(response.status).toBe(302);
            expect(response.headers.get("location")).toBe("/");
            expect(response.headers.get("set-cookie")).toContain("anbaric_session=;");
            expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
        });

        it("sends the browser on to the identity provider's logout when there is one", async () => {
            const server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(),
                undefined, undefined, undefined, undefined, new ProviderAuthenticator());
            const url = `http://127.0.0.1:${await server.listen(0)}`;

            try {
                const response = await fetch(`${url}/logout`, {
                    headers: { cookie: "anbaric_session=valid-session" },
                    redirect: "manual",
                });

                // Clearing our cookie alone would leave the provider's session
                // intact, and the redirect home would sign them back in.
                expect(response.status).toBe(302);
                expect(response.headers.get("location")).toBe("https://login.example/v2/logout");
                expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
            } finally {
                await server.close();
            }
        });

        it("redirects any resource access without a session to the login flow", async () => {
            const response = await fetch(`${authenticatedUrl}/api/v2/jobs`, { redirect: "manual" });

            expect(response.status).toBe(302);
            expect(response.headers.get("location")).toBe("https://login.example/authorize");
        });

        it("serves resources when a valid session cookie is presented", async () => {
            const response = await fetch(`${authenticatedUrl}/api/v2/jobs`, {
                headers: { cookie: "anbaric_session=valid-session" },
            });

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual([]);
        });

        it("identifies the session's user on whoami", async () => {
            const response = await fetch(`${authenticatedUrl}/api/v2/whoami`, {
                headers: { cookie: "anbaric_session=valid-session" },
            });

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ id: "user-1", roles: ["admin"], tenant: "internal" });
        });

        it("keeps ping open without a session", async () => {
            const response = await fetch(`${authenticatedUrl}/ping`);

            expect(response.status).toBe(200);
        });

        it("refuses requests the authorizer denies", async () => {
            const denying = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(),
                undefined, undefined, undefined, undefined, new DenyingAuthenticator());
            const denyingUrl = `http://127.0.0.1:${await denying.listen(0)}`;

            const response = await fetch(`${denyingUrl}/api/v2/jobs`, {
                headers: { cookie: "anbaric_session=valid-session" },
            });

            expect(response.status).toBe(403);
            await denying.close();
        });

        it("has no whoami on a platform without an authenticator", async () => {
            const response = await fetch(`${baseUrl}/api/v2/whoami`);

            expect(response.status).toBe(404);
        });

    });

    describe("cli authorization", () => {

        class StubAuthenticator extends Authenticator {

            async authenticate(session : string | undefined, _request : import("node:http").IncomingMessage,
                               response : import("node:http").ServerResponse) : Promise<[User, Tenant] | undefined> {
                if (session === "valid-session") return [new User("user-1"), new Tenant("internal")];
                response.writeHead(302, { location: "https://login.example/authorize" });
                response.end();
                return undefined;
            }

        }

        let server : HostingServer;
        let baseUrl : string;

        beforeEach(async () => {
            server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(),
                undefined, undefined, undefined, undefined, new StubAuthenticator(),
                new CliAuthorizer(new InMemoryCliKeyStore()));
            baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
        });

        afterEach(async () => {
            await server.close();
        });

        const approve = (requestId : string, clientName : string, url : string = baseUrl) =>
            fetch(`${url}/authorize-cli/${requestId}`, {
                method: "POST",
                headers: { "content-type": "application/json", cookie: "anbaric_session=valid-session" },
                body: JSON.stringify({ clientName }),
            });

        it("returns the platform's own tenant with the issued keypair, not the session's", async () => {
            const tenantServer = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(),
                undefined, undefined, undefined, undefined, new StubAuthenticator(),
                new CliAuthorizer(new InMemoryCliKeyStore()), undefined, "fallback-tenant");
            const tenantUrl = `http://127.0.0.1:${await tenantServer.listen(0)}`;

            await approve("req-tenant", "chris laptop", tenantUrl);
            const issued = await (await fetch(`${tenantUrl}/authorize-cli/req-tenant/poll`)).json();

            expect(issued.tenant).toBe("fallback-tenant");
            expect(issued.privateKey).toContain("PRIVATE KEY");
            await tenantServer.close();
        });

        it("polls as pending without any session", async () => {
            const response = await fetch(`${baseUrl}/authorize-cli/req-1/poll`);

            expect(response.status).toBe(202);
            expect(await response.json()).toEqual({ status: "pending" });
        });

        it("delivers the keypair to the polling CLI exactly once after browser approval", async () => {
            expect((await approve("req-1", "chris laptop")).status).toBe(204);

            const ready = await fetch(`${baseUrl}/authorize-cli/req-1/poll`);
            expect(ready.status).toBe(200);
            const issued = await ready.json();
            expect(issued.clientName).toBe("chris laptop");
            expect(issued.privateKey).toContain("BEGIN PRIVATE KEY");

            expect((await fetch(`${baseUrl}/authorize-cli/req-1/poll`)).status).toBe(202);
        });

        it("guards the authorization page behind the session", async () => {
            const response = await fetch(`${baseUrl}/authorize-cli/req-1`, { redirect: "manual" });

            expect(response.status).toBe(302);
        });

        it("serves the authorization page to a session", async () => {
            const response = await fetch(`${baseUrl}/authorize-cli/req-1`, {
                headers: { cookie: "anbaric_session=valid-session" },
            });
            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe("text/html");
        });

        it("rejects an approval without a client name", async () => {
            const response = await fetch(`${baseUrl}/authorize-cli/req-1`, {
                method: "POST",
                headers: { "content-type": "application/json", cookie: "anbaric_session=valid-session" },
                body: JSON.stringify({}),
            });

            expect(response.status).toBe(400);
        });

        it("lists and revokes the session user's keys", async () => {
            await approve("req-1", "chris laptop");

            const listed = await (await fetch(`${baseUrl}/api/v2/keys`, {
                headers: { cookie: "anbaric_session=valid-session" },
            })).json();
            expect(listed).toHaveLength(1);
            expect(listed[0].clientName).toBe("chris laptop");

            await fetch(`${baseUrl}/api/v2/keys/${listed[0].id}`, {
                method: "DELETE",
                headers: { cookie: "anbaric_session=valid-session" },
            });

            expect(await (await fetch(`${baseUrl}/api/v2/keys`, {
                headers: { cookie: "anbaric_session=valid-session" },
            })).json()).toEqual([]);
        });

    });

    describe("token authentication", () => {

        class RedirectingAuthenticator extends Authenticator {

            async authenticate(_session : string | undefined, _request : import("node:http").IncomingMessage,
                               response : import("node:http").ServerResponse) : Promise<[User, Tenant] | undefined> {
                response.writeHead(302, { location: "https://login.example/authorize" });
                response.end();
                return undefined;
            }

        }

        const keyPair = generateKeyPairSync("ed25519");
        const encoded = (claims : unknown) => Buffer.from(JSON.stringify(claims)).toString("base64url");

        const mintToken = (kid : string, expiresInSeconds : number = 60) => {
            const issuedAt = Math.floor(Date.now() / 1000);
            const header = encoded({ alg: "EdDSA", typ: "JWT", kid });
            const payload = encoded({ iat: issuedAt, exp: issuedAt + expiresInSeconds });
            const signature = sign(null, Buffer.from(`${header}.${payload}`), keyPair.privateKey).toString("base64url");
            return `${header}.${payload}.${signature}`;
        };

        let tokenServer : HostingServer;
        let tokenUrl : string;

        beforeEach(async () => {
            const keyStore = new InMemoryCliKeyStore();
            await keyStore.save(new CliKey("key-1", "user-1", "chris laptop",
                keyPair.publicKey.export({ type: "spki", format: "pem" }).toString()));
            tokenServer = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(),
                undefined, undefined, undefined, undefined, new RedirectingAuthenticator(),
                new CliAuthorizer(keyStore), new TokenAuthenticator(keyStore));
            tokenUrl = `http://127.0.0.1:${await tokenServer.listen(0)}`;
        });

        afterEach(async () => {
            await tokenServer.close();
        });

        it("serves resources for a valid bearer token instead of redirecting to login", async () => {
            const response = await fetch(`${tokenUrl}/api/v2/jobs`, {
                headers: { authorization: `Bearer ${mintToken("key-1")}` },
            });

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual([]);
        });

        it("identifies the token's user on whoami", async () => {
            const response = await fetch(`${tokenUrl}/api/v2/whoami`, {
                headers: { authorization: `Bearer ${mintToken("key-1")}` },
            });

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ id: "user-1", roles: [] });
        });

        it("rejects an invalid bearer token with 401 rather than a login redirect", async () => {
            const response = await fetch(`${tokenUrl}/api/v2/jobs`, {
                headers: { authorization: `Bearer ${mintToken("key-1", -10)}` },
                redirect: "manual",
            });

            expect(response.status).toBe(401);
            expect((await response.json()).error).toContain("anbaric login");
        });

        it("falls back to the session flow when no bearer token is sent", async () => {
            const response = await fetch(`${tokenUrl}/api/v2/jobs`, { redirect: "manual" });

            expect(response.status).toBe(302);
        });

    });

    describe("internal entry point", () => {

        class WallAuthenticator extends Authenticator {

            async authenticate(_session : string | undefined, _request : import("node:http").IncomingMessage,
                               response : import("node:http").ServerResponse) : Promise<[User, Tenant] | undefined> {
                response.writeHead(302, { location: "https://login.example/authorize" });
                response.end();
                return undefined;
            }

        }

        let walledServer : HostingServer;
        let publicUrl : string;
        let internalUrl : string;

        beforeEach(async () => {
            walledServer = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(),
                undefined, undefined, () => new InMemoryJsonStore(),
                () => new InMemorySecretStore(), new WallAuthenticator(),
                new CliAuthorizer(new InMemoryCliKeyStore()));
            publicUrl = `http://127.0.0.1:${await walledServer.listen(0)}`;
            internalUrl = `http://127.0.0.1:${await walledServer.listenInternal(0)}`;
        });

        afterEach(async () => {
            await walledServer.close();
        });

        it("serves workflow resources without any credentials", async () => {
            const response = await fetch(`${internalUrl}/api/v2/jobs`);

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual([]);
        });

        it("answers pings for liveness", async () => {
            const response = await fetch(`${internalUrl}/ping`);

            expect(response.status).toBe(200);
        });

        it("never exposes system endpoints", async () => {
            const systemPaths = ["/apps", "/keys", "/whoami", "/manage-keys",
                "/authorize-cli/req-1", "/authorize-cli/req-1/poll", "/crm", "/"];

            for (const path of systemPaths) {
                const response = await fetch(`${internalUrl}${path}`, { redirect: "manual" });
                expect(response.status, path).toBe(404);
            }
        });

        it("refuses deployment uploads", async () => {
            const response = await fetch(`${internalUrl}/api/v2/apps/crm/deploy`, {
                method: "POST",
                body: new Uint8Array([1]),
            });

            expect(response.status).toBe(404);
        });

        it("keeps the public entry point behind authentication", async () => {
            const response = await fetch(`${publicUrl}/api/v2/jobs`, { redirect: "manual" });

            expect(response.status).toBe(302);
        });

    });

    describe("audits", () => {

        it("accepts audit records through the internal entry point and lists them publicly", async () => {
            const audits = new InMemoryAuditRecordStore();
            const audited = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(),
                undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, audits);
            const publicUrl = `http://127.0.0.1:${await audited.listen(0)}`;
            const internalUrl = `http://127.0.0.1:${await audited.listenInternal(0)}`;

            const posted = await fetch(`${internalUrl}/api/v2/audits`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ resourceType: "job", resourceId: "job-1", actorId: "chris", actorType: "HUMAN", interaction: ["UPDATE_PROPERTIES"], description: "Properties updated", details: { age: 42 } }),
            });
            expect(posted.status).toBe(204);

            const listed = await (await fetch(`${publicUrl}/api/v2/audits?resourceId=job-1`)).json();
            expect(listed).toHaveLength(1);
            expect(listed[0].description).toBe("Properties updated");
            expect(listed[0].actorId).toBe("chris");

            expect(await (await fetch(`${publicUrl}/api/v2/audits?resourceId=other`)).json()).toEqual([]);
            expect(await (await fetch(`${publicUrl}/api/v2/audits?search=updated`)).json()).toHaveLength(1);
            expect(await (await fetch(`${publicUrl}/api/v2/audits?interaction=UPDATE_PROPERTIES`)).json()).toHaveLength(1);
            expect(await (await fetch(`${publicUrl}/api/v2/audits?interaction=DELETE`)).json()).toEqual([]);

            const rejected = await fetch(`${internalUrl}/api/v2/audits`, { method: "POST", body: "{}" });
            expect(rejected.status).toBe(400);

            const badInteraction = await fetch(`${internalUrl}/api/v2/audits`, {
                method: "POST",
                body: JSON.stringify({ resourceType: "job", resourceId: "job-1", actorId: "chris", actorType: "HUMAN", interaction: [], description: "x" }),
            });
            expect(badInteraction.status).toBe(400);

            await audited.close();
        });

    });

    it("serves the landing page at the root", async () => {
        const response = await fetch(`${baseUrl}/`);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("answers pings", async () => {
        const response = await fetch(`${baseUrl}/ping`);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ status: "ok" });
    });

    it("identifies its tenant in the ping when configured", async () => {
        const tenanted = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(),
            undefined, undefined, undefined, undefined, undefined, undefined, undefined, "internal");
        const url = `http://127.0.0.1:${await tenanted.listen(0)}`;

        expect(await (await fetch(`${url}/ping`)).json()).toEqual({ status: "ok", tenant: "internal" });
        await tenanted.close();
    });

    it("returns 404 for unknown routes", async () => {
        const response = await fetch(`${baseUrl}/unknown`);

        expect(response.status).toBe(404);
    });

});
