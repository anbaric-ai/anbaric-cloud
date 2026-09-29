import {WaitForInput} from "../actions/WaitForInput.js";
import {JobProperties} from "./JobProperties.js";

/* One instance moving through a machine. Its properties are read on demand -
   `await job.properties.get(key)` - so a job may hold a great deal without a
   step paying for all of it; a Map given to the constructor is held whole. */
class Job {

    // A workflow is identified by the composite (appId, workflowId): the app the
    // job's state machine was deployed in, and the machine's own id. appId is
    // undefined when running outside a deployed app (locally).
    readonly appId? : string;
    readonly workflowId? : string;

    readonly id : string;
    readonly state: string;
    readonly properties : JobProperties;
    
    readonly startedAt : Date;
    readonly startedBy : string;
    readonly lastUpdated : Date;
    readonly killed : boolean;

    // Distinct from state: the job's processing status. A job whose current
    // state reaches an Await is parked in "Awaiting input" until an update
    // resumes it. waitingFor is the id of the await it is parked on (a foreign
    // key to the awaits table server-side); awaitMetadata is what that Await
    // stored (e.g. the input required). Both clear once the job moves on.
    status : string;
    waitingFor? : string;
    awaitMetadata? : WaitForInput;
    // When a long-running step last said it was still going; unset when no
    // such step is running.
    heartbeatAt? : Date;

    constructor(id : string, properties : Map<string, any> | JobProperties = new Map(), state: string, workflowId? : string,
                appId? : string, startedBy : string = "system", startedAt : Date = new Date(),
                lastUpdated : Date = startedAt, killed : boolean = false,
                status : string = Job.Status.ACTIVE, awaitMetadata? : WaitForInput,
                waitingFor? : string, heartbeatAt? : Date) {

        this.id = id;
        this.properties = properties instanceof JobProperties ? properties : new JobProperties(properties);
        this.state = state;
        this.workflowId = workflowId;
        this.appId = appId;
        this.startedBy = startedBy;
        this.startedAt = startedAt;
        this.lastUpdated = lastUpdated;
        this.killed = killed;
        this.status = status;
        this.awaitMetadata = awaitMetadata;
        this.waitingFor = waitingFor;
        this.heartbeatAt = heartbeatAt;
    }

}

namespace Job {

    export const Status = {
        ACTIVE: "active",
        AWAITING_INPUT: "Awaiting input",
        FAILED: "Failed",
        // A long-running step stopped heartbeating: the process running it
        // most likely died. Nothing acts on it; someone resumes it or not.
        STALLED: "Stalled",
    } as const;

    // How long a long-running step may go without a heartbeat before its job
    // is marked Stalled; the machine heartbeats every minute.
    export const HEARTBEAT_INTERVAL_MS = 60_000;
    export const STALL_AFTER_MS = 5 * 60_000;

}

export { Job }
