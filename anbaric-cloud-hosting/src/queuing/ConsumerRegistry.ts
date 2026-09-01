class ConsumerRegistry {

    private consumers = new Map<string, { appId? : string, workflowId : string, url : string }>();

    // Consumers are keyed by the (appId, workflowId) composite, encoded as a
    // tuple so an app and a machine id can never collide.
    private key(appId : string | undefined, workflowId : string) : string {
        return JSON.stringify([appId || null, workflowId]);
    }

    register(appId : string | undefined, workflowId : string, url : string) : void {
        this.consumers.set(this.key(appId, workflowId), { appId, workflowId, url });
    }

    lookup(appId : string | undefined, workflowId : string) : string | undefined {
        return this.consumers.get(this.key(appId, workflowId))?.url;
    }

    list() : Array<{ appId? : string, workflowId : string, url : string }> {
        return Array.from(this.consumers.values());
    }

}

export { ConsumerRegistry }
