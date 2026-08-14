import {generateKeyPairSync, sign} from "node:crypto";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {Job, JsonStore, QueueMessage} from "anbaric-tsapi";
import {CloudJobPersistence, CloudJsonStore, CloudQueue, CloudSecretStore} from "anbaric-cloud";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {InMemoryJsonStore, InMemorySecretStore} from "anbaric-data-store";
import {Authenticator} from "../../src/auth/Authenticator";
import {CliAuthorizer} from "../../src/auth/CliAuthorizer";
import {CliKey} from "../../src/auth/CliKey";
import {InMemoryCliKeyStore} from "../../src/auth/InMemoryCliKeyStore";
import {Role} from "../../src/auth/Role";
import {TokenAuthenticator} from "../../src/auth/TokenAuthenticator";
import {User} from "../../src/auth/User";
import {ConfirmableQueue} from "../../src/queuing/ConfirmableQueue";
import {HostingServer} from "../../src/hosting/HostingServer";

const makeJob = (id : string, properties : Map<string, any> = new Map()) => new Job(id, properties, "start");

class ConfirmableInMemoryQueue extends InMemoryQueue implements ConfirmableQueue {

    confirmed : Array<QueueMessage> = [];

    async confirm(message : QueueMessage) : Promise<void> {
        this.confirmed.push(message);
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
        server = new HostingServer(new InMemoryJobPersistence(), backingQueue, undefined, undefined,
            (collection) => {
                if (!documentStores.has(collection)) documentStores.set(collection, new InMemoryJsonStore());
                return documentStores.get(collection)!;
            },
            new InMemorySecretStore());
        const port = await server.listen(0);
        baseUrl = `http://127.0.0.1:${port}`;
        persistence = new CloudJobPersistence(baseUrl);
        queue = new CloudQueue(baseUrl);
    });

    afterEach(async () => {
        await server.close();
    });

    describe("job persistence", () => {

        it("saves and retrieves a job", async () => {
            await persistence.save(makeJob("job-1", new Map([["colour", "red"]])));

            const retrieved = await persistence.retrieve("job-1");

            expect(retrieved.id).toBe("job-1");
            expect(retrieved.stateId).toBe("start");
            expect(retrieved.properties.get("colour")).toBe("red");
        });

        it("rejects retrieval of an unknown job", async () => {
            await expect(persistence.retrieve("missing")).rejects.toThrowError('No job found with id "missing"');
        });

        it("updates properties by merging", async () => {
            await persistence.save(makeJob("job-1", new Map([["colour", "red"]])));

            await persistence.updateProperties("job-1", new Map([["size", "large"]]));

            const updated = await persistence.retrieve("job-1");
            expect(updated.properties.get("colour")).toBe("red");
            expect(updated.properties.get("size")).toBe("large");
        });

        it("deletes a job", async () => {
            await persistence.save(makeJob("job-1"));

            await persistence.delete("job-1");

            await expect(persistence.retrieve("job-1")).rejects.toThrowError();
        });

        it("lists jobs with paging", async () => {
            for (const id of ["a", "b", "c"]) {
                await persistence.save(makeJob(id));
            }

            expect((await persistence.list()).map(job => job.id)).toEqual(["a", "b", "c"]);
            expect((await persistence.list(2, 1)).map(job => job.id)).toEqual(["c"]);
        });

    });

    describe("queue", () => {

        it("enqueues messages into the platform's queue in order", async () => {
            await queue.enqueue("job-1", "workflow-1");
            await queue.enqueue("job-2", "workflow-2");

            expect(await backingQueue.dequeueSome()).toEqual([
                { jobId: "job-1", workflowId: "workflow-1" },
                { jobId: "job-2", workflowId: "workflow-2" },
            ]);
        });

        it("schedules messages for later release", async () => {
            await queue.schedule("past-due", "workflow-1", new Date(Date.now() - 1000));
            await queue.schedule("future", "workflow-1", new Date(Date.now() + 60_000));

            expect(await backingQueue.dequeueSome()).toEqual([{ jobId: "past-due", workflowId: "workflow-1" }]);
        });

        it("passes confirm messages through to the backing queue", async () => {
            const response = await fetch(`${baseUrl}/queue/confirm`, {
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

            await store.save("ada", { name: "Ada" });

            expect(await store.retrieve("ada")).toEqual({ name: "Ada" });
        });

        it("rejects an invalid document client-side before it reaches the platform", async () => {
            const store = new CloudJsonStore("customers", customerSchema, baseUrl);

            await expect(store.save("bad", { name: 7 })).rejects.toThrowError("failed schema validation");
            expect(await store.list()).toEqual([]);
        });

        it("keeps collections separate", async () => {
            const customers = new CloudJsonStore("customers", customerSchema, baseUrl);
            const orders = new CloudJsonStore("orders", undefined, baseUrl);

            await customers.save("ada", { name: "Ada" });
            await orders.save("order-1", { total: 42 });

            expect(await customers.list()).toEqual([{ name: "Ada" }]);
            expect(await orders.list()).toEqual([{ total: 42 }]);
        });

        it("deletes documents and 404s unknown ids", async () => {
            const store = new CloudJsonStore("customers", customerSchema, baseUrl);
            await store.save("ada", { name: "Ada" });

            await store.delete("ada");

            await expect(store.retrieve("ada")).rejects.toThrowError('No document found with id "ada"');
        });

    });

    describe("secrets", () => {

        it("round-trips a secret through the cloud store", async () => {
            const secrets = new CloudSecretStore(baseUrl);

            await secrets.save("api-key", "s3cr3t");

            expect(await secrets.retrieve("api-key")).toBe("s3cr3t");
        });

        it("lists secret names", async () => {
            const secrets = new CloudSecretStore(baseUrl);

            await secrets.save("api-key", "a");
            await secrets.save("db-password", "b");

            expect(await secrets.list()).toEqual(["api-key", "db-password"]);
        });

        it("deletes secrets and 404s unknown names", async () => {
            const secrets = new CloudSecretStore(baseUrl);
            await secrets.save("api-key", "s3cr3t");

            await secrets.delete("api-key");

            await expect(secrets.retrieve("api-key")).rejects.toThrowError('No secret found with name "api-key"');
        });

        it("rejects a non-string secret value", async () => {
            const response = await fetch(`${baseUrl}/secrets/api-key`, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ value: 42 }),
            });

            expect(response.status).toBe(400);
        });

    });

    it("lists registered state machines", async () => {
        await fetch(`${baseUrl}/consumers`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ workflowId: "workflow-1", url: "http://app:8788" }),
        });

        const stateMachines = await (await fetch(`${baseUrl}/state-machines`)).json();

        expect(stateMachines).toEqual([{ workflowId: "workflow-1", url: "http://app:8788" }]);
    });

    describe("authentication", () => {

        class StubAuthenticator extends Authenticator {

            async authenticate(session : string | undefined, _request : import("node:http").IncomingMessage,
                               response : import("node:http").ServerResponse) : Promise<User | undefined> {
                if (session === "valid-session") return new User("user-1", [new Role("admin")]);
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

        it("redirects any resource access without a session to the login flow", async () => {
            const response = await fetch(`${authenticatedUrl}/jobs`, { redirect: "manual" });

            expect(response.status).toBe(302);
            expect(response.headers.get("location")).toBe("https://login.example/authorize");
        });

        it("serves resources when a valid session cookie is presented", async () => {
            const response = await fetch(`${authenticatedUrl}/jobs`, {
                headers: { cookie: "anbaric_session=valid-session" },
            });

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual([]);
        });

        it("identifies the session's user on whoami", async () => {
            const response = await fetch(`${authenticatedUrl}/whoami`, {
                headers: { cookie: "anbaric_session=valid-session" },
            });

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ id: "user-1", roles: ["admin"] });
        });

        it("keeps ping open without a session", async () => {
            const response = await fetch(`${authenticatedUrl}/ping`);

            expect(response.status).toBe(200);
        });

        it("refuses requests the authorizer denies", async () => {
            const denying = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(),
                undefined, undefined, undefined, undefined, new DenyingAuthenticator());
            const denyingUrl = `http://127.0.0.1:${await denying.listen(0)}`;

            const response = await fetch(`${denyingUrl}/jobs`, {
                headers: { cookie: "anbaric_session=valid-session" },
            });

            expect(response.status).toBe(403);
            await denying.close();
        });

        it("has no whoami on a platform without an authenticator", async () => {
            const response = await fetch(`${baseUrl}/whoami`);

            expect(response.status).toBe(404);
        });

    });

    describe("cli authorization", () => {

        class StubAuthenticator extends Authenticator {

            async authenticate(session : string | undefined, _request : import("node:http").IncomingMessage,
                               response : import("node:http").ServerResponse) : Promise<User | undefined> {
                if (session === "valid-session") return new User("user-1");
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

        const approve = (requestId : string, clientName : string) =>
            fetch(`${baseUrl}/authorize-cli/${requestId}`, {
                method: "POST",
                headers: { "content-type": "application/json", cookie: "anbaric_session=valid-session" },
                body: JSON.stringify({ clientName }),
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

        it("serves the authorization and manage-keys pages to a session", async () => {
            for (const path of ["/authorize-cli/req-1", "/manage-keys"]) {
                const response = await fetch(`${baseUrl}${path}`, {
                    headers: { cookie: "anbaric_session=valid-session" },
                });
                expect(response.status).toBe(200);
                expect(response.headers.get("content-type")).toBe("text/html");
            }
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

            const listed = await (await fetch(`${baseUrl}/keys`, {
                headers: { cookie: "anbaric_session=valid-session" },
            })).json();
            expect(listed).toHaveLength(1);
            expect(listed[0].clientName).toBe("chris laptop");

            await fetch(`${baseUrl}/keys/${listed[0].id}`, {
                method: "DELETE",
                headers: { cookie: "anbaric_session=valid-session" },
            });

            expect(await (await fetch(`${baseUrl}/keys`, {
                headers: { cookie: "anbaric_session=valid-session" },
            })).json()).toEqual([]);
        });

    });

    describe("token authentication", () => {

        class RedirectingAuthenticator extends Authenticator {

            async authenticate(_session : string | undefined, _request : import("node:http").IncomingMessage,
                               response : import("node:http").ServerResponse) : Promise<User | undefined> {
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
            const response = await fetch(`${tokenUrl}/jobs`, {
                headers: { authorization: `Bearer ${mintToken("key-1")}` },
            });

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual([]);
        });

        it("identifies the token's user on whoami", async () => {
            const response = await fetch(`${tokenUrl}/whoami`, {
                headers: { authorization: `Bearer ${mintToken("key-1")}` },
            });

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ id: "user-1", roles: [] });
        });

        it("rejects an invalid bearer token with 401 rather than a login redirect", async () => {
            const response = await fetch(`${tokenUrl}/jobs`, {
                headers: { authorization: `Bearer ${mintToken("key-1", -10)}` },
                redirect: "manual",
            });

            expect(response.status).toBe(401);
            expect((await response.json()).error).toContain("anbaric login");
        });

        it("falls back to the session flow when no bearer token is sent", async () => {
            const response = await fetch(`${tokenUrl}/jobs`, { redirect: "manual" });

            expect(response.status).toBe(302);
        });

    });

    describe("internal entry point", () => {

        class WallAuthenticator extends Authenticator {

            async authenticate(_session : string | undefined, _request : import("node:http").IncomingMessage,
                               response : import("node:http").ServerResponse) : Promise<User | undefined> {
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
                new InMemorySecretStore(), new WallAuthenticator(),
                new CliAuthorizer(new InMemoryCliKeyStore()));
            publicUrl = `http://127.0.0.1:${await walledServer.listen(0)}`;
            internalUrl = `http://127.0.0.1:${await walledServer.listenInternal(0)}`;
        });

        afterEach(async () => {
            await walledServer.close();
        });

        it("serves workflow resources without any credentials", async () => {
            const response = await fetch(`${internalUrl}/jobs`);

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
            const response = await fetch(`${internalUrl}/apps/crm/deploy`, {
                method: "POST",
                body: new Uint8Array([1]),
            });

            expect(response.status).toBe(404);
        });

        it("keeps the public entry point behind authentication", async () => {
            const response = await fetch(`${publicUrl}/jobs`, { redirect: "manual" });

            expect(response.status).toBe(302);
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

    it("returns 404 for unknown routes", async () => {
        const response = await fetch(`${baseUrl}/unknown`);

        expect(response.status).toBe(404);
    });

});
