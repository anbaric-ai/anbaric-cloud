import {PlatformClient} from "../PlatformClient";
import {bold, dim} from "../ui/Ansi";
import {renderTable} from "../ui/Table";

type JobRow = {
    id : string,
    state : string,
    status? : string,
    killed? : boolean,
    properties : Record<string, any>,
    workflowId? : string,
    appId? : string,
};

type JobsListing = {
    state? : string,
    status? : string,
    app? : string,
    page? : number,
    pageSize? : number,
    oldest? : boolean,
};

const DEFAULT_PAGE_SIZE = 100;
const PROPERTY_PREVIEW_LIMIT = 60;

const previewProperties = (properties : Record<string, any>) : string => {
    const rendered = Object.entries(properties).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ");
    return rendered.length > PROPERTY_PREVIEW_LIMIT ? `${rendered.slice(0, PROPERTY_PREVIEW_LIMIT - 1)}…` : rendered;
};

/* Lists jobs a page at a time, newest first, narrowed by whatever the flags
   say. The platform does the narrowing and the paging, so a filter sees every
   job on the platform, not just the ones on the first page. */
class JobsCommand {

    constructor(private client : PlatformClient) {}

    async run(stateMachineId? : string, listing : JobsListing = {}) : Promise<number> {
        const page = listing.page ?? 0;
        const pageSize = listing.pageSize ?? DEFAULT_PAGE_SIZE;
        const parameters = new URLSearchParams({
            page: String(page),
            pageSize: String(pageSize),
            order: listing.oldest ? "oldest" : "newest",
        });
        if (stateMachineId) parameters.set("workflowId", stateMachineId);
        if (listing.state) parameters.set("state", listing.state);
        if (listing.status) parameters.set("status", listing.status);
        if (listing.app) parameters.set("appId", listing.app);

        const jobs = await this.client.get(`/jobs?${parameters}`) as Array<JobRow>;

        if (jobs.length === 0) {
            console.log(dim(page > 0 ? `No more jobs (page ${page})` : stateMachineId
                ? `No jobs for state machine "${stateMachineId}"`
                : "No jobs match"));
            return 0;
        }

        console.log(renderTable(
            ["JOB", "APP", "STATE MACHINE", "STATE", "STATUS", "PROPERTIES"],
            jobs.map(job => [
                job.id,
                job.appId ?? dim("-"),
                job.workflowId ?? dim("unknown"),
                bold(job.state),
                job.killed ? dim("killed") : (job.status ?? ""),
                dim(previewProperties(job.properties)),
            ]),
        ));
        console.log(dim(jobs.length === pageSize
            ? `Page ${page}: ${jobs.length} jobs — there may be more; --page ${page + 1} for the next page`
            : `Page ${page}: ${jobs.length} jobs — last page`));
        return 0;
    }

}

export { JobsCommand }
export type { JobsListing }
