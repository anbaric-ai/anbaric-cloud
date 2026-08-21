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
    cleanUp() : Promise<void>;

}

export type { BuildLayer, DeploymentStatus, DeploymentSummary };
