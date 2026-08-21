import {Transition} from "../transitions/Transition";

class Job {

    readonly id : string;
    readonly state: string;
    readonly properties : Map<string, any>;
    readonly workflowId? : string;
    readonly startedAt : Date;
    readonly startedBy : string;
    readonly lastUpdated : Date;
    readonly killed : boolean;

    constructor(id : string, properties : Map<string, any> = new Map(), state: string, workflowId? : string,
                startedBy : string = "system", startedAt : Date = new Date(),
                lastUpdated : Date = startedAt, killed : boolean = false) {

        this.id = id;
        this.properties = properties;
        this.state = state;
        this.workflowId = workflowId;
        this.startedBy = startedBy;
        this.startedAt = startedAt;
        this.lastUpdated = lastUpdated;
        this.killed = killed;
    }

}

export { Job }
