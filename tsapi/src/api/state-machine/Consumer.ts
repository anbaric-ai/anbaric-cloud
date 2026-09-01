interface Consumer {

    subscribe(appId : string | undefined, workflowId : string, processJob : (jobId : string) => Promise<void>) : void;
    cleanUp() : Promise<void>;

}

export { Consumer }
