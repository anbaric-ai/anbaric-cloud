type QueueMessage = {
    jobId : string,
    appId? : string,
    workflowId : string,
    position? : number,
};

export type { QueueMessage }
