import {PlatformClient} from "./platform/PlatformClient";
import {actorName, anbaricClient} from "./client";
import {deployApp} from "./deploy";

type Tool = {
    name : string,
    description : string,
    inputSchema : Record<string, any>,
    run : (args : Record<string, any>) => Promise<unknown>,
};

const noInput = { type: "object", properties: {}, additionalProperties: false };

const object = (properties : Record<string, any>, required : Array<string> = []) =>
    ({ type: "object", properties, required, additionalProperties: false });

const resolveAppId = async (client : PlatformClient, workflowId : string) : Promise<string | undefined> => {
    const machines = await client.get("/state-machines") as Array<{ appId? : string, workflowId : string }>;
    const matches = machines.filter(machine => machine.workflowId === workflowId);
    if (matches.length > 1) {
        throw new Error(`Workflow "${workflowId}" exists in more than one app (${matches.map(match => match.appId ?? "—").join(", ")}); it cannot be addressed by workflow id alone.`);
    }
    return matches[0]?.appId;
};

const enqueue = async (client : PlatformClient, jobId : string, appId : string | undefined, workflowId? : string) : Promise<boolean> => {
    if (!workflowId) return false;
    await client.post("/queue/enqueue", { jobId, appId, workflowId });
    return true;
};

const fetchLogs = async (client : PlatformClient, appName : string, lines : number) : Promise<Array<string>> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let buffer = "";
    try {
        await client.stream(`/apps/${encodeURIComponent(appName)}/logs`, text => {
            buffer += text;
            if (buffer.split("\n").length > lines) controller.abort();
        }, controller.signal);
    } catch (error) {
        if (!controller.signal.aborted) throw error;
    } finally {
        clearTimeout(timeout);
    }
    return buffer.split("\n").filter(row => row.length > 0).slice(-lines);
};

const tools : Array<Tool> = [
    {
        name: "anbaric_whoami",
        description: "Report the platform URL, tenant and identity this session is authenticated as. Use it to confirm the developer is signed in before deploying or driving jobs.",
        inputSchema: noInput,
        run: async () => (await anbaricClient()).get("/whoami"),
    },
    {
        name: "anbaric_apps",
        description: "List the apps deployed to the current tenant, with their status and port.",
        inputSchema: noInput,
        run: async () => (await anbaricClient()).get("/apps"),
    },
    {
        name: "anbaric_app_status",
        description: "Get one app's deploy state (building / running / failed), port and recent build log.",
        inputSchema: object({ name: { type: "string", description: "The app name" } }, ["name"]),
        run: async (args) => (await anbaricClient()).get(`/apps/${encodeURIComponent(args.name)}`),
    },
    {
        name: "anbaric_app_logs",
        description: "Fetch the most recent runtime log lines for a deployed app (bounded snapshot, not a live tail).",
        inputSchema: object({
            name: { type: "string", description: "The app name" },
            lines: { type: "number", description: "How many recent lines to return (default 200)" },
        }, ["name"]),
        run: async (args) => fetchLogs(await anbaricClient(), args.name, args.lines ?? 200),
    },
    {
        name: "anbaric_deploy",
        description: "Package a local Anbaric app directory (its .anbaric/app-config.json supplies name and port), upload it and wait for the build to go live. Returns the final status and URL. The developer must be signed in (`anbaric login`).",
        inputSchema: object({
            directory: { type: "string", description: "Path to the app project root (the folder containing .anbaric/app-config.json)" },
        }, ["directory"]),
        run: async (args) => deployApp(await anbaricClient(), args.directory),
    },
    {
        name: "anbaric_state_machines",
        description: "List the state machines registered across deployed apps, with their app and workflow ids.",
        inputSchema: noInput,
        run: async () => (await anbaricClient()).get("/state-machines"),
    },
    {
        name: "anbaric_jobs_list",
        description: "List jobs, optionally filtered to a single workflow (state machine) id.",
        inputSchema: object({
            workflowId: { type: "string", description: "Only return jobs for this state machine id" },
        }),
        run: async (args) => {
            const jobs = await (await anbaricClient()).get("/jobs") as Array<{ workflowId? : string }>;
            return args.workflowId ? jobs.filter(job => job.workflowId === args.workflowId) : jobs;
        },
    },
    {
        name: "anbaric_job_get",
        description: "Fetch one job by id, including its state, properties and transition history.",
        inputSchema: object({ jobId: { type: "string" } }, ["jobId"]),
        run: async (args) => (await anbaricClient()).get(`/jobs/${encodeURIComponent(args.jobId)}`),
    },
    {
        name: "anbaric_jobs_stats",
        description: "Get job counts per state and the current queue size.",
        inputSchema: noInput,
        run: async () => {
            const client = await anbaricClient();
            const { states } = await client.get("/jobs/stats") as { states : unknown };
            const { size } = await client.get("/queue/size") as { size : number };
            return { states, queueSize: size };
        },
    },
    {
        name: "anbaric_job_create",
        description: "Create a job in a workflow at a start state with the given properties, and queue it for processing.",
        inputSchema: object({
            workflowId: { type: "string", description: "The state machine id to create the job in" },
            startState: { type: "string", description: "The state id the job starts in" },
            properties: { type: "object", description: "Initial job properties", additionalProperties: true },
        }, ["workflowId", "startState"]),
        run: async (args) => {
            const client = await anbaricClient();
            const id = crypto.randomUUID();
            const now = new Date().toISOString();
            const appId = await resolveAppId(client, args.workflowId);
            await client.put(`/jobs/${encodeURIComponent(id)}`, {
                id,
                state: args.startState,
                properties: args.properties ?? {},
                workflowId: args.workflowId,
                appId,
                startedBy: await actorName(),
                startedAt: now,
                lastUpdated: now,
            });
            const queued = await enqueue(client, id, appId, args.workflowId);
            return { id, state: args.startState, workflowId: args.workflowId, queued };
        },
    },
    {
        name: "anbaric_job_update",
        description: "Merge properties into a job and re-queue it for processing.",
        inputSchema: object({
            jobId: { type: "string" },
            properties: { type: "object", description: "Properties to set (merged over existing)", additionalProperties: true },
        }, ["jobId", "properties"]),
        run: async (args) => {
            const client = await anbaricClient();
            const job = await client.get(`/jobs/${encodeURIComponent(args.jobId)}`);
            job.properties = { ...(job.properties ?? {}), ...args.properties };
            job.lastUpdated = new Date().toISOString();
            await client.put(`/jobs/${encodeURIComponent(args.jobId)}`, job);
            const queued = await enqueue(client, args.jobId, job.appId, job.workflowId);
            return { id: args.jobId, properties: job.properties, queued };
        },
    },
    {
        name: "anbaric_job_set_state",
        description: "Move a job to a state, record the transition and re-queue it for processing.",
        inputSchema: object({
            jobId: { type: "string" },
            state: { type: "string", description: "The state id to move the job to" },
        }, ["jobId", "state"]),
        run: async (args) => {
            const client = await anbaricClient();
            const job = await client.get(`/jobs/${encodeURIComponent(args.jobId)}`);
            const previousState = job.state;
            job.state = args.state;
            job.transitions = [...(job.transitions ?? []), { from: previousState, to: args.state, actor: await actorName() }];
            job.lastUpdated = new Date().toISOString();
            await client.put(`/jobs/${encodeURIComponent(args.jobId)}`, job);
            const queued = await enqueue(client, args.jobId, job.appId, job.workflowId);
            return { id: args.jobId, from: previousState, to: args.state, queued };
        },
    },
    {
        name: "anbaric_job_kill",
        description: "Kill a job so it stops progressing through its state machine.",
        inputSchema: object({ jobId: { type: "string" } }, ["jobId"]),
        run: async (args) => {
            await (await anbaricClient()).post(`/jobs/${encodeURIComponent(args.jobId)}/kill`, {});
            return { id: args.jobId, killed: true };
        },
    },
];

export {tools};
export type {Tool};
