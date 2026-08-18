import {Job} from "./Job";

type SerializedJob = {
    id : string,
    state : string,
    properties : Record<string, any>,
    workflowId? : string,
    startedAt? : string,
    startedBy? : string,
    lastUpdated? : string,
};

const serializeJob = (job : Job) : SerializedJob => ({
    id: job.id,
    state: job.state,
    properties: Object.fromEntries(job.properties),
    workflowId: job.workflowId,
    startedAt: job.startedAt.toISOString(),
    startedBy: job.startedBy,
    lastUpdated: job.lastUpdated.toISOString(),
});

const deserializeJob = (serialized : SerializedJob) : Job => {
    const startedAt = serialized.startedAt ? new Date(serialized.startedAt) : new Date();
    return new Job(serialized.id, new Map(Object.entries(serialized.properties)), serialized.state,
        serialized.workflowId, serialized.startedBy ?? "system", startedAt,
        serialized.lastUpdated ? new Date(serialized.lastUpdated) : startedAt);
};

export { serializeJob, deserializeJob };
export type { SerializedJob };
