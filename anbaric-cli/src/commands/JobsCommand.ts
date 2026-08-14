import {PlatformClient} from "../PlatformClient";
import {bold, dim} from "../ui/Ansi";
import {renderTable} from "../ui/Table";

type JobRow = {
    id : string,
    state : string,
    properties : Record<string, any>,
    workflowId? : string,
};

const PROPERTY_PREVIEW_LIMIT = 60;

const previewProperties = (properties : Record<string, any>) : string => {
    const rendered = Object.entries(properties).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ");
    return rendered.length > PROPERTY_PREVIEW_LIMIT ? `${rendered.slice(0, PROPERTY_PREVIEW_LIMIT - 1)}…` : rendered;
};

class JobsCommand {

    constructor(private client : PlatformClient) {}

    async run(stateMachineId? : string) : Promise<number> {
        const jobs = await this.client.get("/jobs") as Array<JobRow>;
        const matching = stateMachineId ? jobs.filter(job => job.workflowId === stateMachineId) : jobs;

        if (matching.length === 0) {
            console.log(dim(stateMachineId
                ? `No jobs for state machine "${stateMachineId}"`
                : "No jobs on this platform"));
            return 0;
        }

        console.log(renderTable(
            ["JOB", "STATE MACHINE", "STATE", "PROPERTIES"],
            matching.map(job => [
                job.id,
                job.workflowId ?? dim("unknown"),
                bold(job.state),
                dim(previewProperties(job.properties)),
            ]),
        ));
        return 0;
    }

}

export { JobsCommand }
