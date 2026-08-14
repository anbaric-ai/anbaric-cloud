import {describe, expect, it} from "vitest";
import {Actor} from "../src/api/actors/Actor";
import {Action} from "../src/api/actions/Action";
import {Job} from "../src/api/jobs/Job";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const human : Actor = { type: "HUMAN", id: "chris", role: "admin" };
const agent : Actor = { type: "AGENT", id: "helper", role: "assistant" };
const code = (run : (job : Job) => Promise<Map<string, any>>) : Actor =>
    ({ type: "CODE", id: "code-1", role: "code", run }) as Actor;

describe("Action", () => {

    it("generates a uuid id by default", () => {
        expect(new Action("Approve", human).id).toMatch(UUID_PATTERN);
    });

    it("keeps a given id", () => {
        expect(new Action("Approve", human, "", "action-1").id).toBe("action-1");
    });

    it("stores its name, description and actor", () => {
        const action = new Action("Approve", human, "Approves the request");

        expect(action.name).toBe("Approve");
        expect(action.description).toBe("Approves the request");
        expect(action.actor).toBe(human);
    });

    it("accepts any job by default", () => {
        const action = new Action("Approve", human);

        expect(action.predicate(new Job("job-1", new Map(), "start"))).toBe(true);
    });

    it("supports a custom predicate", () => {
        const action = new Action("Approve", human);
        action.predicate = (job) => job.properties.has("approved");

        expect(action.predicate(new Job("job-1", new Map(), "start"))).toBe(false);
        expect(action.predicate(new Job("job-2", new Map([["approved", true]]), "start"))).toBe(true);
    });

    it("runs a code actor's function against the job", async () => {
        const action = new Action("Stamp", code(async (job) => new Map([["stamped", job.id]])));

        const properties = await action.run(new Job("job-1", new Map(), "start"));

        expect(properties).toEqual(new Map([["stamped", "job-1"]]));
    });

    it("refuses to run a human action", async () => {
        const action = new Action("Approve", human);

        await expect(action.run(new Job("job-1", new Map(), "start")))
            .rejects.toThrowError('Actions for "HUMAN" actors are not implemented yet');
    });

    it("refuses to run an agent action", async () => {
        const action = new Action("Suggest", agent);

        await expect(action.run(new Job("job-1", new Map(), "start")))
            .rejects.toThrowError('Actions for "AGENT" actors are not implemented yet');
    });

});
