import {Action} from "../actions/Action.js";
import {Await} from "../actions/Await.js";
import {Reads} from "../jobs/Reads.js";
import {Transition} from "../transitions/Transition.js";

/* A state: its actions run in order, then the first transition whose guard
   holds moves the job on. `prewarm` names the properties to load before the
   pass, in one fetch - everything by default; a state that needs a little of a
   job that holds a lot narrows it, and anything it missed still loads on
   demand. */
class State {

    readonly id : string;
    actions : Array<Action | Await>;
    transitions : Array<Transition>;
    readonly isTerminal : boolean;
    prewarm : Reads = Reads.everything;

    constructor(id : string, actions : Array<Action | Await> = [], transitions : Array<Transition> = [], isTerminal : boolean = false) {
        this.id = id;
        this.actions = actions;
        this.transitions = transitions;
        this.isTerminal = isTerminal;
    }

    subscribe(action : Action | Await) : void {
        this.actions.push(action);
    }

}

export { State }