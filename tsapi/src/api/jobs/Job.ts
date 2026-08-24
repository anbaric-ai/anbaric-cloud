import {WaitForInput} from "../actions/WaitForInput";

class Job {

    readonly id : string;
    readonly state: string;
    readonly properties : Map<string, any>;
    readonly workflowId? : string;
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

    constructor(id : string, properties : Map<string, any> = new Map(), state: string, workflowId? : string,
                startedBy : string = "system", startedAt : Date = new Date(),
                lastUpdated : Date = startedAt, killed : boolean = false,
                status : string = Job.Status.ACTIVE, awaitMetadata? : WaitForInput,
                waitingFor? : string) {

        this.id = id;
        this.properties = properties;
        this.state = state;
        this.workflowId = workflowId;
        this.startedBy = startedBy;
        this.startedAt = startedAt;
        this.lastUpdated = lastUpdated;
        this.killed = killed;
        this.status = status;
        this.awaitMetadata = awaitMetadata;
        this.waitingFor = waitingFor;
    }

}

namespace Job {

    export const Status = {
        ACTIVE: "active",
        AWAITING_INPUT: "Awaiting input",
    } as const;

}

export { Job }
