import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {InMemoryPromptManager} from "anbaric-data-store";
import {PromptManager, QueueMessage} from "anbaric-tsapi";
import {CloudPromptManager} from "anbaric-impl-cloud";
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

describe("prompts end to end through the cloud client", () => {

    let server : HostingServer;
    let internalUrl : string;
    let managers : Map<string, PromptManager>;

    beforeEach(async () => {
        process.env.ANBARIC_APP_ID = "crm";
        managers = new Map();
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined, undefined,
            undefined, undefined, undefined, undefined, undefined, undefined, undefined, [], undefined, undefined,
            undefined, undefined, undefined,
            (appId) => managers.get(appId) ?? managers.set(appId, new InMemoryPromptManager(appId)).get(appId)!);
        internalUrl = `http://127.0.0.1:${await server.listenInternal(0)}`;
    });

    afterEach(async () => {
        delete process.env.ANBARIC_APP_ID;
        await server.close();
    });

    it("saves, versions and retrieves an app's prompts", async () => {
        const prompts = new CloudPromptManager(internalUrl);

        const first = await prompts.save("triage", "Decide the priority.", { type: "object" });
        const same = await prompts.save("triage", "Decide the priority.", { type: "object" });
        const second = await prompts.save("triage", "Decide the priority, favouring high.", { type: "object" });

        expect([first.version, same.version, second.version]).toEqual([1, 1, 2]);
        expect((await prompts.retrieve("triage")).version).toBe(2);
        expect((await prompts.retrieve("triage", 1)).instructions).toBe("Decide the priority.");
        expect((await prompts.list()).map(prompt => prompt.promptId)).toEqual(["triage"]);
        expect((await prompts.history("triage")).map(prompt => prompt.version)).toEqual([2, 1]);
    });

    it("keeps prompts apart per app and 404s unknown ones", async () => {
        await new CloudPromptManager(internalUrl).save("triage", "crm's");
        process.env.ANBARIC_APP_ID = "billing";

        expect(await new CloudPromptManager(internalUrl).list()).toEqual([]);
        await expect(new CloudPromptManager(internalUrl).retrieve("triage")).rejects.toThrow('No prompt found with id "triage"');
    });

    it("refuses requests without the app header or without instructions", async () => {
        const noApp = await fetch(`${internalUrl}/api/v2/prompts`);
        const noInstructions = await fetch(`${internalUrl}/api/v2/prompts/triage`, {
            method: "PUT", headers: { "content-type": "application/json", "x-anbaric-app": "crm" }, body: JSON.stringify({}),
        });
        const badVersion = await fetch(`${internalUrl}/api/v2/prompts/triage?version=latest`, { headers: { "x-anbaric-app": "crm" } });

        expect(noApp.status).toBe(400);
        expect(noInstructions.status).toBe(400);
        expect(badVersion.status).toBe(400);
    });

});
