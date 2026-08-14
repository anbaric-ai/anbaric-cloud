class ConsumerRegistry {

    private consumers = new Map<string, string>();

    register(workflowId : string, url : string) : void {
        this.consumers.set(workflowId, url);
    }

    lookup(workflowId : string) : string | undefined {
        return this.consumers.get(workflowId);
    }

    list() : Array<{ workflowId : string, url : string }> {
        return Array.from(this.consumers, ([workflowId, url]) => ({ workflowId, url }));
    }

}

export { ConsumerRegistry }
