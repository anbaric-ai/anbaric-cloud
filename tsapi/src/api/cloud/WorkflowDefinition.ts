import {State} from "../states/State.js";
import {PropertyDefinition} from "../jobs/PropertyDefinition.js";
import {Await} from "../actions/Await.js";

/* The serialisable graph of a state machine: its states, each state's actions
   (identity only — the run/predicate bodies aren't persistable) and
   transitions. Recorded as the details of an audit record when a state machine
   initialises. Awaits are pause points rather than actors acting, so they are
   not part of the graph - awaiting jobs are surfaced separately. */
type WorkflowDefinition = {

    appId? : string,
    workflowId : string,
    startState : string,
    dataSchema : Array<{ id : string, required : boolean, example? : any }>,
    states : Array<{
        id : string,
        isTerminal : boolean,
        actions : Array<{ name : string, description : string, actor : { id : string, type : string, roles : Array<string> } }>,
        transitions : Array<{ to : string }>,
    }>,

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
            transitions: state.transitions.map(transition => ({ to: transition.to })),
        })),
    });

}

export { WorkflowDefinition }
