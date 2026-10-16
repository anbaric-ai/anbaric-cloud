import {describe, expect, it} from "vitest";
import {WorkflowDefinition} from "anbaric-tsapi";
import {InMemoryStateMachineStore} from "../../src/data-store/InMemoryStateMachineStore";
import {definitionHash, isNewVersion, UNKNOWN_HASH} from "../../src/data-store/StateMachineStore";

const definition = (states : Array<string>) : WorkflowDefinition => ({
    workflowId: "orders",
    startState: states[0],
    dataSchema: [],
    states: states.map(id => ({ id, isTerminal: false, actions: [], awaits: [], transitions: [] })),
});

const registration = (definition? : WorkflowDefinition, url : string = "http://crm.apps:8788") =>
    ({ appId: "crm", workflowId: "orders", url, definition });

describe("definitionHash", () => {

    it("hashes the same definition the same whatever its key order", () => {
        const a = { workflowId: "w", startState: "s", dataSchema: [], states: [] };
        const b = { states: [], dataSchema: [], startState: "s", workflowId: "w" };

        expect(definitionHash(a)).toBe(definitionHash(b));
        expect(definitionHash(definition(["a"]))).not.toBe(definitionHash(definition(["b"])));
    });

    it("is unknown for no definition, which never makes a new version", () => {
        expect(definitionHash(undefined)).toBe(UNKNOWN_HASH);
        expect(isNewVersion(UNKNOWN_HASH, "abc")).toBe(false);
        expect(isNewVersion("abc", UNKNOWN_HASH)).toBe(false);
        expect(isNewVersion("abc", "abd")).toBe(true);
        expect(isNewVersion("abc", "abc")).toBe(false);
    });

});

describe("InMemoryStateMachineStore", () => {

    it("registers a machine as version 1 and lists it", async () => {
        const store = new InMemoryStateMachineStore();

        const machine = await store.register(registration(definition(["new", "done"])));

        expect(machine).toMatchObject({ appId: "crm", workflowId: "orders", url: "http://crm.apps:8788", version: 1 });
        expect(machine.definition).toEqual(definition(["new", "done"]));
        expect((await store.list()).map(each => [each.workflowId, each.version])).toEqual([["orders", 1]]);
    });

    it("keeps the version when the same definition registers again, moving only when it was last seen", async () => {
        const store = new InMemoryStateMachineStore();
        const first = await store.register(registration(definition(["new"])));
        await new Promise(resolve => setTimeout(resolve, 5));

        const again = await store.register(registration(definition(["new"]), "http://crm.apps:8790"));

        expect(again.version).toBe(1);
        expect(again.url).toBe("http://crm.apps:8790");
        expect(again.registeredAt).toEqual(first.registeredAt);
        expect(again.lastRegistered.getTime()).toBeGreaterThan(first.lastRegistered.getTime());
    });

    it("starts a new version when the definition changes, and lists only the latest", async () => {
        const store = new InMemoryStateMachineStore();
        await store.register(registration(definition(["new"])));

        const changed = await store.register(registration(definition(["new", "done"])));

        expect(changed.version).toBe(2);
        expect(changed.definition).toEqual(definition(["new", "done"]));
        expect(await store.list()).toEqual([expect.objectContaining({ workflowId: "orders", version: 2 })]);
    });

    it("adopts a definition into a version that had none, rather than versioning it", async () => {
        const store = new InMemoryStateMachineStore();
        await store.register(registration(undefined));

        const described = await store.register(registration(definition(["new"])));
        const undescribed = await store.register(registration(undefined));

        expect(described.version).toBe(1);
        expect(described.definition).toEqual(definition(["new"]));
        expect(undescribed.version).toBe(1);
        expect(undescribed.definition).toEqual(definition(["new"]));
    });

    it("tells apart the same workflow id in different apps, and no app at all", async () => {
        const store = new InMemoryStateMachineStore();
        await store.register({ appId: "crm", workflowId: "orders", url: "http://crm:1" });
        await store.register({ appId: "shop", workflowId: "orders", url: "http://shop:1" });
        await store.register({ workflowId: "orders", url: "http://localhost:1" });

        const listed = await store.list();

        expect(listed.map(machine => machine.appId).sort()).toEqual(["crm", "shop", undefined]);
        expect(listed.every(machine => machine.version === 1)).toBe(true);
    });

});
