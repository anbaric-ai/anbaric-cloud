type DeploymentStatus = "building" | "running" | "failed" | "stopped";

type DeploymentSummary = {
    appName : string,
    status : DeploymentStatus,
    appPort : number,
    appHost : string,
};

interface BuildLayer {

    ensureHydrated() : Promise<void>;
    deploy(appName : string, appPort : number, tarball : Buffer) : DeploymentSummary;
    status(appName : string) : (DeploymentSummary & { log : Array<string> }) | undefined;
    list() : Array<DeploymentSummary>;
    ping(appName : string) : Promise<boolean>;
    logs(appName : string, signal : AbortSignal) : AsyncIterable<string>;
    teardown(appName : string) : Promise<boolean>;
    // Re-runs documentation generation for an already-deployed app from its
    // uploaded source, without redeploying it. Returns the number of docs written.
    regenerateDocs(appName : string) : Promise<number>;
    cleanUp() : Promise<void>;

}

export type { BuildLayer, DeploymentStatus, DeploymentSummary };
