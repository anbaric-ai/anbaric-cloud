import {Job} from "./Job";

type SerializedJob = {
    id : string,
    state : string,
    properties : Record<string, any>,
    workflowId? : string,
};

const serializeJob = (job : Job) : SerializedJob => ({
    id: job.id,
    state: job.stateId!,
    properties: Object.fromEntries(job.properties),
    workflowId: job.workflowId,
});

const deserializeJob = (serialized : SerializedJob) : Job =>
    new Job(serialized.id, new Map(Object.entries(serialized.properties)), serialized.state, serialized.workflowId);

export { serializeJob, deserializeJob };
export type { SerializedJob };
