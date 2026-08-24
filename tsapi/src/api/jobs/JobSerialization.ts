import {Job} from "./Job";
import {SerializedWaitForInput, serializeWaitForInput, deserializeWaitForInput} from "../actions/WaitForInput";

type SerializedJob = {
    id : string,
    state : string,
    properties : Record<string, any>,
    workflowId? : string,
    startedAt? : string,
    startedBy? : string,
    lastUpdated? : string,
    killed? : boolean,
    status? : string,
    waitingFor? : string,
    awaitMetadata? : SerializedWaitForInput,
};

const serializeJob = (job : Job) : SerializedJob => ({
    id: job.id,
    state: job.state,
    properties: Object.fromEntries(job.properties),
    workflowId: job.workflowId,
    startedAt: job.startedAt.toISOString(),
    startedBy: job.startedBy,
    lastUpdated: job.lastUpdated.toISOString(),
    killed: job.killed,
    status: job.status,
    waitingFor: job.waitingFor,
    awaitMetadata: job.awaitMetadata ? serializeWaitForInput(job.awaitMetadata) : undefined,
});

const deserializeJob = (serialized : SerializedJob) : Job => {
    const startedAt = serialized.startedAt ? new Date(serialized.startedAt) : new Date();
    return new Job(serialized.id, new Map(Object.entries(serialized.properties)), serialized.state,
        serialized.workflowId, serialized.startedBy ?? "system", startedAt,
        serialized.lastUpdated ? new Date(serialized.lastUpdated) : startedAt, serialized.killed ?? false,
        serialized.status ?? Job.Status.ACTIVE,
        serialized.awaitMetadata ? deserializeWaitForInput(serialized.awaitMetadata) : undefined,
        serialized.waitingFor);
};

export { serializeJob, deserializeJob };
export type { SerializedJob };
