import {Job} from "./Job";

type SerializedJob = {
    id : string,
    state : string,
    properties : Record<string, any>,
};

const serializeJob = (job : Job) : SerializedJob => ({
    id: job.id,
    state: job.stateId!,
    properties: Object.fromEntries(job.properties),
});

const deserializeJob = (serialized : SerializedJob) : Job =>
    new Job(serialized.id, new Map(Object.entries(serialized.properties)), serialized.state);

export { serializeJob, deserializeJob };
export type { SerializedJob };
