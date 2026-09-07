import {Notifier} from "anbaric-tsapi";

/* Unlike the other factories there is no local implementation to fall back on:
   nothing sensible can be delivered from a laptop, so running outside a
   platform yields undefined and a state machine simply doesn't notify. A host
   that can deliver registers one during start-up, before any state machine is
   constructed, and every machine built afterwards picks it up. */

let registered : Notifier | undefined;

const NotifierFactory = {

    use(notifier : Notifier | undefined) : void {
        registered = notifier;
    },

    instance() : Notifier | undefined {
        return registered;
    },

}

export { NotifierFactory };
