import {WorkflowDefinition} from "../cloud/WorkflowDefinition.js";

/* Takes the messages queued for a state machine and runs its steps. A
   subscription may carry the machine's definition, which a hosted platform
   keeps so the machine can be shown, and its versions told apart, without
   the app being asked. */
interface Consumer {

    subscribe(appId : string | undefined, workflowId : string, processJob : (jobId : string) => Promise<void>,
              definition? : WorkflowDefinition) : void;
    cleanUp() : Promise<void>;

}

export { Consumer }
