interface Consumer {

    subscribe(workflowId : string, processJob : (jobId : string) => Promise<void>) : void;
    cleanUp() : Promise<void>;

}

export { Consumer }
