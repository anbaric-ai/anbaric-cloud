import {Job} from "./Job.js";
import {SerializedWaitForInput, serializeWaitForInput, deserializeWaitForInput} from "../actions/WaitForInput.js";

type SerializedJob = {
    id : string,
    state : string,
    properties : Record<string, any>,
    workflowId? : string,
    appId? : string,
    startedAt? : string,
    startedBy? : string,
    lastUpdated? : string,
    killed? : boolean,
    status? : string,
    waitingFor? : string,
    awaitMetadata? : SerializedWaitForInput,
    heartbeatAt? : string,
};

// Carries the properties the job holds right now - all of them for a job read
// whole, the loaded ones for a job read on demand.
const serializeJob = (job : Job) : SerializedJob => ({
    id: job.id,
    state: job.state,
    properties: Object.fromEntries(job.properties.snapshot()),
    workflowId: job.workflowId,
    appId: job.appId,
    startedAt: job.startedAt.toISOString(),
    startedBy: job.startedBy,
    lastUpdated: job.lastUpdated.toISOString(),
    killed: job.killed,
    status: job.status,
    waitingFor: job.waitingFor,
    awaitMetadata: job.awaitMetadata ? serializeWaitForInput(job.awaitMetadata) : undefined,
    heartbeatAt: job.heartbeatAt?.toISOString(),
});

const deserializeJob = (serialized : SerializedJob) : Job => {
    const startedAt = serialized.startedAt ? new Date(serialized.startedAt) : new Date();
    return new Job(serialized.id, new Map(Object.entries(serialized.properties)), serialized.state,
        serialized.workflowId, serialized.appId, serialized.startedBy ?? "system", startedAt,
        serialized.lastUpdated ? new Date(serialized.lastUpdated) : startedAt, serialized.killed ?? false,
        serialized.status ?? Job.Status.ACTIVE,
        serialized.awaitMetadata ? deserializeWaitForInput(serialized.awaitMetadata) : undefined,
        serialized.waitingFor, serialized.heartbeatAt ? new Date(serialized.heartbeatAt) : undefined);
};

export { serializeJob, deserializeJob };
export type { SerializedJob };
