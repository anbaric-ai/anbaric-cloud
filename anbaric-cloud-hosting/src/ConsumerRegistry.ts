class ConsumerRegistry {

    private consumers = new Map<string, string>();

    register(workflowId : string, url : string) : void {
        this.consumers.set(workflowId, url);
    }

    lookup(workflowId : string) : string | undefined {
        return this.consumers.get(workflowId);
    }

}

export { ConsumerRegistry }
