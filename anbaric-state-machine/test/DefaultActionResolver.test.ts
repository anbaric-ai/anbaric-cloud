import {describe, expect, it} from "vitest";
import {Action, Job} from "anbaric-tsapi";
import {DefaultActionResolver} from "../src/actions/DefaultActionResolver";

const actionMatching = (predicate : (job : Job) => boolean) => {
    const action = new Action();
    action.predicate = predicate;
    return action;
};

describe("DefaultActionResolver", () => {

    const resolver = new DefaultActionResolver();
    const job = new Job("job-1", new Map([["approved", true]]), "start");

    it("keeps only actions whose predicate accepts the job", () => {
        const matching = actionMatching(j => j.properties.has("approved"));
        const rejecting = actionMatching(() => false);

        expect(resolver.resolve([matching, rejecting], job)).toEqual([matching]);
    });

    it("preserves candidate order", () => {
        const first = actionMatching(() => true);
        const second = actionMatching(() => true);

        expect(resolver.resolve([first, second], job)).toEqual([first, second]);
    });

    it("returns nothing when no predicate matches", () => {
        expect(resolver.resolve([actionMatching(() => false)], job)).toEqual([]);
    });

    it("returns nothing for no candidates", () => {
        expect(resolver.resolve([], job)).toEqual([]);
    });

});
