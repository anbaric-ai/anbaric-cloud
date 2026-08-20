type QueueMessage = {
    jobId : string,
    workflowId : string,
    position? : number,
};

export type { QueueMessage }
