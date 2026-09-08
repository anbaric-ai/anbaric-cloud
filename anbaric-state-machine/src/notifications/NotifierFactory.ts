import {Notifier} from "anbaric-tsapi";
import {CloudNotifier} from "anbaric-impl-cloud";

/* Like the other services, the notifier is chosen by environment. There is no
   local implementation - nothing can be delivered from a laptop - so with no
   env a machine simply doesn't notify. Deployed, the platform sets
   ANBARIC_NOTIFIER_TYPE=cloud and the app posts to the platform, which owns
   delivery. */
const NotifierFactory = {

    instance() : Notifier | undefined {
        switch (process.env.ANBARIC_NOTIFIER_TYPE) {
            case "cloud":
                return new CloudNotifier();
            default:
                return undefined;
        }
    },

}

export { NotifierFactory };
