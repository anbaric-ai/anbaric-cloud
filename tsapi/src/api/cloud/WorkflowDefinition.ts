import {State} from "../states/State.js";
import {Job} from "../jobs/Job.js";
import {PropertyDefinition} from "../jobs/PropertyDefinition.js";
import {Await} from "../actions/Await.js";

/* The serialisable graph of a state machine: its states, each state's actions
   (identity only — the run/predicate bodies aren't persistable), its awaits
   (the pause points, and which kind of party each waits on) and transitions.
   Recorded as the details of an audit record when a state machine
   initialises. Awaiting jobs themselves are surfaced separately. */
type WorkflowDefinition = {

    appId? : string,
    workflowId : string,
    startState : string,
    dataSchema : Array<{ id : string, required : boolean, example? : any }>,
    states : Array<{
        id : string,
        isTerminal : boolean,
        actions : Array<{ name : string, description : string, actor : { id : string, type : string, roles : Array<string> } }>,
        awaits : Array<{ name : string, description : string, waitingFor? : "HUMAN" | "EXTERNAL_SYSTEM" }>,
        transitions : Array<{ to : string, predicate? : string }>,
    }>,

};

/* A predicate's own source, so tools can show what a transition tests rather
   than only where it goes. Apps run their TypeScript unbundled, so this reads
   as the author wrote it. An unguarded transition always fires and has nothing
   worth showing, so it is left out. */
const ALWAYS = ["() => true", "()=>true", "function () { return true; }"];

const sourceOf = (predicate : (job : Job) => boolean) : string | undefined => {
    let source : string;
    try {
        source = predicate.toString().trim();
    } catch {
        return undefined;
    }

    return ALWAYS.includes(source) ? undefined : source;
};

namespace WorkflowDefinition {

    export const describe = (appId : string | undefined, workflowId : string, startState : string,
                             states : Array<State>, dataSchema : Array<PropertyDefinition>) : WorkflowDefinition => ({
        appId,
        workflowId,
        startState,
        dataSchema: dataSchema.map(property => ({
            id: property.id,
            required: property.required,
            ...(property.example === undefined ? {} : { example: property.example }),
        })),
        states: states.map(state => ({
            id: state.id,
            isTerminal: state.isTerminal,
            actions: state.actions
                .filter((action) : action is Exclude<typeof action, Await> => ! (action instanceof Await))
                .map(action => ({
                    name: action.name,
                    description: action.description,
                    actor: { id: action.actor.id, type: action.actor.type, roles: action.actor.roles },
                })),
            awaits: state.actions
                .filter((action) : action is Await => action instanceof Await)
                .map(waiting => ({
                    name: waiting.name,
                    description: waiting.description,
                    ...(waiting.waitingFor === undefined ? {} : { waitingFor: waiting.waitingFor }),
                })),
            transitions: state.transitions.map(transition => ({
                to: transition.to,
                ...(sourceOf(transition.predicate) === undefined ? {} : { predicate: sourceOf(transition.predicate) }),
            })),
        })),
    });

}

export { WorkflowDefinition }
