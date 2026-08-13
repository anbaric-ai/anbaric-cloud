class Job {

    readonly id : string;
    private state?: string;
    properties : Map<string, any>;

    constructor(id : string, properties : Map<string, any> = new Map()) {
        this.id = id;
        this.properties = properties;
    }

    setState(stateId : string) : void {
        this.state = stateId;
    }

    get stateId() : string | undefined {
        return this.state;
    }

}

export { Job }
