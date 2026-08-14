import {describe, expect, it} from "vitest";
import {Actor} from "../src/api/actors/Actor";
import {Action} from "../src/api/actions/Action";
import {Job} from "../src/api/jobs/Job";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const human : Actor = { type: "HUMAN", id: "chris", role: "admin" };

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

    it("returns no properties by default", async () => {
        const action = new Action("Approve", human);

        expect(await action.run(new Job("job-1", new Map(), "start"))).toEqual(new Map());
    });

    it("supports a custom run function", async () => {
        const action = new Action("Stamp", human);
        action.run = async (job) => new Map([["stamped", job.id]]);

        expect(await action.run(new Job("job-1", new Map(), "start"))).toEqual(new Map([["stamped", "job-1"]]));
    });

});
