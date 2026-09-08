import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Job, Notifier, QueueMessage, WaitForInput} from "anbaric-tsapi";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {CloudNotifier} from "anbaric-impl-cloud";
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

describe("notifications round-trip through the cloud client", () => {

    let server : HostingServer;
    let received : Array<{ targets : Array<string>, job : Job, waitingFor : WaitForInput }>;
    let notifier : CloudNotifier;

    const serverNotifier : Notifier = {
        notify: async (targets, job, waitingFor) => { received.push({ targets, job, waitingFor }); },
    };

    beforeEach(async () => {
        received = [];
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(),
            undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
            undefined, [], undefined, serverNotifier);
        const port = await server.listen(0);
        notifier = new CloudNotifier(`http://127.0.0.1:${port}`);
    });

    afterEach(async () => {
        await server.close();
    });

    const job = () => new Job("job-1", new Map([["title", "Acme"]]), "review", "approvals", "crm");
    const waiting = () => new WaitForInput(["decision"], "/runs/job-1", new Map(), "HUMAN");

    it("delivers the targets to the platform's notifier", async () => {
        await notifier.notify(["reviewer@example.com"], job(), waiting());

        expect(received).toHaveLength(1);
        expect(received[0].targets).toEqual(["reviewer@example.com"]);
    });

    it("reconstructs the job and its wait across the wire", async () => {
        await notifier.notify(["a@example.com"], job(), waiting());

        expect(received[0].job.id).toBe("job-1");
        expect(received[0].job.properties.get("title")).toBe("Acme");
        expect(received[0].waitingFor.resolveUrl).toBe("/runs/job-1");
        expect(received[0].waitingFor.fields).toEqual(["decision"]);
    });

    it("is absent when the platform has no notifier, so posting fails rather than silently dropping", async () => {
        const withoutNotifier = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue());
        const port = await withoutNotifier.listen(0);
        try {
            const client = new CloudNotifier(`http://127.0.0.1:${port}`);
            await expect(client.notify(["a@example.com"], job(), waiting())).rejects.toThrow();
        } finally {
            await withoutNotifier.close();
        }
    });

});
