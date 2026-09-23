import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {BuildLayer} from "../../src/app-management/BuildLayer";
import {CliAuthorizer} from "../../src/auth/CliAuthorizer";
import {InMemoryCliKeyStore} from "../../src/auth/InMemoryCliKeyStore";
import {InMemoryMembershipService} from "../../src/auth/InMemoryMembershipService";
import {SessionSigner} from "../../src/auth/SessionSigner";
import {Tenant} from "../../src/auth/Tenant";
import {TenantRole} from "../../src/auth/TenantRole";
import {User} from "../../src/auth/User";
import {HostingServer} from "../../src/hosting/HostingServer";
import {RemoteQueue} from "../../src/queuing/RemoteQueue";

class ConfirmableInMemoryQueue extends InMemoryQueue implements RemoteQueue {

    async confirm(_message : QueueMessage) : Promise<void> {
    }

    async debounce(_message : QueueMessage) : Promise<void> {
    }

    async cancel(_message : QueueMessage) : Promise<void> {
    }

    async size() : Promise<number> {
        return 0;
    }

}

const SECRET = "app-roles-secret";

const summary = { appName: "crm", appHost: "crm", appPort: 3000, status: "running" as const };

const stubBuildLayer = () => ({
    ensureHydrated: vi.fn(async () => {}),
    deploy: vi.fn(() => ({ ...summary, status: "building" as const })),
    status: vi.fn(() => ({ ...summary, log: [] })),
    list: vi.fn(() => [summary]),
    ping: vi.fn(async () => true),
    logs: vi.fn(),
    teardown: vi.fn(async () => true),
    regenerateDocs: vi.fn(async () => 0),
    cleanUp: vi.fn(async () => {}),
}) as unknown as BuildLayer;

describe("who may change what is deployed", () => {

    let server : HostingServer;
    let baseUrl : string;
    let memberships : InMemoryMembershipService;
    let buildLayer : BuildLayer;

    beforeEach(async () => {
        process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET;
        memberships = new InMemoryMembershipService();
        memberships.add("owner", "OWNER");
        memberships.add("builder", "BUILDER");
        memberships.add("reader", "USER");
        buildLayer = stubBuildLayer();
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined, buildLayer,
            undefined, undefined, undefined, new CliAuthorizer(new InMemoryCliKeyStore()), undefined, "acme",
            undefined, [], undefined, undefined, undefined, undefined, memberships);
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    });

    afterEach(async () => {
        delete process.env.ANBARIC_SESSION_SIGNING_SECRET;
        await server.close();
    });

    const as = (id : string) =>
        `anbaric_session=${new SessionSigner(SECRET).mint(new User(id), new Tenant("acme"))}`;

    const deploy = (id : string) => fetch(`${baseUrl}/api/v2/apps/crm/deploy?port=3000`, {
        method: "POST", headers: { cookie: as(id) }, body: "a tarball",
    });

    const teardown = (id : string) => fetch(`${baseUrl}/api/v2/apps/crm`, { method: "DELETE", headers: { cookie: as(id) } });

    it("lets an owner and a builder deploy", async () => {
        expect((await deploy("owner")).status).toBe(202);
        expect((await deploy("builder")).status).toBe(202);
    });

    it("refuses a deploy from a plain user", async () => {
        const response = await deploy("reader");

        expect(response.status).toBe(403);
        expect((await response.json()).error).toContain("cannot deploy");
        expect(buildLayer.deploy).not.toHaveBeenCalled();
    });

    it("refuses a teardown from a plain user, but allows a builder", async () => {
        expect((await teardown("reader")).status).toBe(403);
        expect((await teardown("builder")).status).toBe(200);
    });

    it("still lets a plain user look at what is deployed", async () => {
        const listed = await fetch(`${baseUrl}/api/v2/apps`, { headers: { cookie: as("reader") } });
        const status = await fetch(`${baseUrl}/api/v2/apps/crm`, { headers: { cookie: as("reader") } });

        expect(listed.status).toBe(200);
        expect(status.status).toBe(200);
    });

    it("refuses anyone who is not a member of the tenant at all", async () => {
        const response = await deploy("stranger");

        expect(response.status).toBe(403);
        expect((await response.json()).error).toContain("not a member");
    });

    it("refuses a keypair to a plain user, and issues one to a builder", async () => {
        const approve = (id : string, requestId : string) => fetch(`${baseUrl}/authorize-cli/${requestId}`, {
            method: "POST", headers: { "content-type": "application/json", cookie: as(id) },
            body: JSON.stringify({ clientName: "a laptop" }),
        });

        expect((await approve("reader", "req-user")).status).toBe(403);
        expect((await approve("builder", "req-builder")).status).toBe(204);
    });

    it("tells the console which role the session holds", async () => {
        const who = await (await fetch(`${baseUrl}/api/v2/whoami`, { headers: { cookie: as("builder") } })).json();

        expect(who).toMatchObject({ id: "builder", tenant: "acme", tenantRole: "BUILDER" as TenantRole });
    });

});
