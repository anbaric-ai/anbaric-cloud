import {Action, Code, JobPersistence, PropertyDefinition, Queue, State, StateMachine, Transition} from "anbaric";

// TODO: model YOUR domain. Rename "items" and define the real lifecycle as
// states + transitions; give every property a definition with validation.

const title = new PropertyDefinition("title");
title.required = true;
title.validation = (value) => typeof value === "string" && value.length > 0;

const processed = new PropertyDefinition("processed");
processed.validation = (value) => typeof value === "boolean";

const processItem = new Action("Process the item", new Code("processor"),
    "Does the work for a newly created item");
processItem.run = async (job) => {
    // TODO: the real work, reading from job.properties
    return new Map([["processed", true]]);
};

export const itemsMachine = (persistence : JobPersistence, queue : Queue) => new StateMachine(
    "items",
    [
        new State("new", [processItem], [new Transition("done", (job) => job.properties.get("processed") === true)]),
        new State("done"),
    ],
    "new",
    [title, processed],
    persistence,
    queue,
);
