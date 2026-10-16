import {createHash} from "node:crypto";
import {WorkflowDefinition} from "anbaric-tsapi";

/* What an app tells the platform when one of its state machines starts:
   which machine, where its consumer listens, and what the machine looks
   like. An app built on a library older than the definition sends none. */
type StateMachineRegistration = {
    appId? : string,
    workflowId : string,
    url : string,
    definition? : WorkflowDefinition,
};

/* A machine as the platform remembers it. The version counts the distinct
   definitions seen for the machine, in order; a registration whose
   definition matches the latest only moves `lastRegistered`. A hash of ""
   means the definition is unknown - a backfilled row, or an old app. */
type RegisteredStateMachine = {
    appId? : string,
    workflowId : string,
    url? : string,
    version : number,
    hash : string,
    definition? : WorkflowDefinition,
    registeredAt : Date,
    lastRegistered : Date,
};

const UNKNOWN_HASH = "";

const canonical = (value : unknown) : unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])]));
    }
    return value;
};

/* The same definition always hashes the same, whatever order the app's
   library happened to write its keys in. */
const definitionHash = (definition? : WorkflowDefinition) : string =>
    definition === undefined ? UNKNOWN_HASH : createHash("sha256").update(JSON.stringify(canonical(definition))).digest("hex");

/* Whether a registration is a new version of what is already held: only when
   both definitions are known and differ. An unknown one on either side is
   taken as the same machine, so the known definition is kept or adopted. */
const isNewVersion = (latestHash : string, hash : string) : boolean =>
    latestHash !== UNKNOWN_HASH && hash !== UNKNOWN_HASH && latestHash !== hash;

interface StateMachineStore {

    register(registration : StateMachineRegistration) : Promise<RegisteredStateMachine>;
    // The latest version of every machine, most recently registered first.
    list() : Promise<Array<RegisteredStateMachine>>;

}

export { definitionHash, isNewVersion, UNKNOWN_HASH };
export type { StateMachineStore, StateMachineRegistration, RegisteredStateMachine };
