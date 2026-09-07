import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {QueueMessage} from "anbaric-tsapi";
import {InMemoryJobPersistence, InMemoryJobRunSchedulePersistence, InMemoryQueue} from "anbaric-state-machine";
import {CloudJobRunSchedulePersistence} from "anbaric-impl-cloud";
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

const at = (iso : string) => new Date(iso);

describe("job run schedules round-trip through the cloud client", () => {

    let server : HostingServer;
    let store : InMemoryJobRunSchedulePersistence;
    let schedules : CloudJobRunSchedulePersistence;

    beforeEach(async () => {
        store = new InMemoryJobRunSchedulePersistence();
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(),
            undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
            undefined, [], store);
        const port = await server.listen(0);
        schedules = new CloudJobRunSchedulePersistence(`http://127.0.0.1:${port}`);
    });

    afterEach(async () => {
        await server.close();
    });

    it("reports no high water mark for a machine that has never been planned", async () => {
        expect(await schedules.highWaterMark("crm", "nightly")).toBeUndefined();
    });

    it("plans runs and reports the latest as the high water mark", async () => {
        await schedules.plan([
            { appId: "crm", workflowId: "nightly", runAt: at("2026-03-01T09:00:00.000Z") },
            { appId: "crm", workflowId: "nightly", runAt: at("2026-03-02T09:00:00.000Z") },
        ]);

        expect(await schedules.highWaterMark("crm", "nightly")).toEqual(at("2026-03-02T09:00:00.000Z"));
    });

    it("keeps machines apart", async () => {
        await schedules.plan([{ appId: "crm", workflowId: "nightly", runAt: at("2026-03-01T09:00:00.000Z") }]);

        expect(await schedules.highWaterMark("crm", "weekly")).toBeUndefined();
        expect(await schedules.highWaterMark("billing", "nightly")).toBeUndefined();
    });

    it("claims only the runs that are due", async () => {
        await schedules.plan([
            { appId: "crm", workflowId: "nightly", runAt: at("2026-03-01T09:00:00.000Z") },
            { appId: "crm", workflowId: "nightly", runAt: at("2026-03-05T09:00:00.000Z") },
        ]);

        const claimed = await schedules.claimDue(at("2026-03-02T00:00:00.000Z"));

        expect(claimed).toHaveLength(1);
        expect(claimed[0].runAt).toEqual(at("2026-03-01T09:00:00.000Z"));
        expect(claimed[0].workflowId).toBe("nightly");
    });

    it("does not hand the same run to a second claim", async () => {
        await schedules.plan([{ appId: "crm", workflowId: "nightly", runAt: at("2026-03-01T09:00:00.000Z") }]);

        await schedules.claimDue(at("2026-03-02T00:00:00.000Z"));

        expect(await schedules.claimDue(at("2026-03-02T00:00:00.000Z"))).toEqual([]);
    });

    it("ignores a run that is already planned", async () => {
        const run = { appId: "crm", workflowId: "nightly", runAt: at("2026-03-01T09:00:00.000Z") };

        await schedules.plan([run]);
        await schedules.plan([run]);

        expect(await schedules.claimDue(at("2026-03-02T00:00:00.000Z"))).toHaveLength(1);
    });

    it("treats a machine outside a deployed app as having an empty app id", async () => {
        await schedules.plan([{ appId: "", workflowId: "local", runAt: at("2026-03-01T09:00:00.000Z") }]);

        expect(await schedules.highWaterMark("", "local")).toEqual(at("2026-03-01T09:00:00.000Z"));
    });

    it("sends nothing over the wire when there is nothing to plan", async () => {
        await expect(schedules.plan([])).resolves.toBeUndefined();
    });

});
