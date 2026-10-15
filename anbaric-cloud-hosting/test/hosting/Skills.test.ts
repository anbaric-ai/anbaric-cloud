import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {QueueMessage} from "anbaric-tsapi";
import {InMemoryMembershipService} from "../../src/auth/InMemoryMembershipService";
import {SessionSigner} from "../../src/auth/SessionSigner";
import {Tenant} from "../../src/auth/Tenant";
import {User} from "../../src/auth/User";
import {InMemorySkillStore} from "../../src/data-store/InMemorySkillStore";
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

const SECRET = "skills-secret";

const skill = { title: "Fetching web pages", usageHints: "Read before fetching any external page", body: "POST /html with { url }" };

describe("a tenant's skills", () => {

    let server : HostingServer;
    let baseUrl : string;
    let internalUrl : string;
    let skills : InMemorySkillStore;

    beforeEach(async () => {
        process.env.ANBARIC_SESSION_SIGNING_SECRET = SECRET;
        const memberships = new InMemoryMembershipService();
        memberships.add("builder", "BUILDER");
        memberships.add("reader", "USER");
        skills = new InMemorySkillStore();
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined, undefined,
            undefined, undefined, undefined, undefined, undefined, "acme",
            undefined, [], undefined, undefined, undefined, undefined, memberships,
            undefined, undefined, undefined, undefined, undefined, skills);
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
        internalUrl = `http://127.0.0.1:${await server.listenInternal(0)}`;
    });

    afterEach(async () => {
        delete process.env.ANBARIC_SESSION_SIGNING_SECRET;
        await server.close();
    });

    const as = (id : string) =>
        `anbaric_session=${new SessionSigner(SECRET).mint(new User(id), new Tenant("acme"))}`;

    const put = (who : string, id : string, body : unknown) =>
        fetch(`${baseUrl}/api/v2/skills/${id}`, {
            method: "PUT", headers: { "content-type": "application/json", cookie: as(who) }, body: JSON.stringify(body),
        });

    const get = (who : string, path : string = "") =>
        fetch(`${baseUrl}/api/v2/skills${path}`, { headers: { cookie: as(who) } });

    it("lets a builder write a skill, which anyone in the tenant can then read", async () => {
        const saved = await put("builder", "web-fetching", skill);

        expect(saved.status).toBe(200);
        expect(await saved.json()).toMatchObject({ id: "web-fetching", ...skill });
        expect(await (await get("reader")).json()).toMatchObject([{ id: "web-fetching", title: "Fetching web pages" }]);
        expect((await (await get("reader", "/web-fetching")).json()).body).toBe("POST /html with { url }");
    });

    it("replaces a skill written again under the same id", async () => {
        await put("builder", "web-fetching", skill);

        await put("builder", "web-fetching", { ...skill, body: "POST /html with { url, stealth: true }" });

        expect(await (await get("builder")).json()).toHaveLength(1);
        expect((await (await get("builder", "/web-fetching")).json()).body).toContain("stealth");
    });

    it("removes a skill, after which it is gone", async () => {
        await put("builder", "web-fetching", skill);

        const removed = await fetch(`${baseUrl}/api/v2/skills/web-fetching`, { method: "DELETE", headers: { cookie: as("builder") } });

        expect(removed.status).toBe(204);
        expect((await get("builder", "/web-fetching")).status).toBe(404);
        expect((await fetch(`${baseUrl}/api/v2/skills/web-fetching`, { method: "DELETE", headers: { cookie: as("builder") } })).status).toBe(404);
    });

    it("is a builder's to write, not a user's", async () => {
        await put("builder", "web-fetching", skill);

        expect((await put("reader", "other", skill)).status).toBe(403);
        expect((await fetch(`${baseUrl}/api/v2/skills/web-fetching`, { method: "DELETE", headers: { cookie: as("reader") } })).status).toBe(403);
        expect(await skills.get("web-fetching")).toBeDefined();
    });

    it("wants a well-formed id and every field", async () => {
        expect((await put("builder", "Web%20Fetching", skill)).status).toBe(400);
        expect((await put("builder", "web-fetching", { ...skill, title: "" })).status).toBe(400);
        expect((await put("builder", "web-fetching", { title: "x", body: "y" })).status).toBe(400);
        expect((await get("builder", "/web-fetching/history")).status).toBe(404);
    });

    // A deployed app has no business reading what its builders told their agents.
    it("is not served to apps on the internal entry point", async () => {
        await put("builder", "web-fetching", skill);

        expect((await fetch(`${internalUrl}/api/v2/skills`)).status).toBe(404);
    });

});
