/* building: the new version is being built; draining: the running version has
   been told to stop taking on work and is finishing what it has in hand
   before being replaced or removed; then running, failed or stopped. */
type DeploymentStatus = "building" | "draining" | "running" | "failed" | "stopped";

type Draining = {
    inFlight : number,
    since : string,
};

/* How big an app's instance is. Small is what every app starts as; large is
   faster compute and four times the memory, and costs more. The sizes are
   named rather than numbered so the platform can change what they mean. */
type AppSize = "small" | "large";

const APP_SIZES : Array<AppSize> = ["small", "large"];

const isAppSize = (value : unknown) : value is AppSize =>
    typeof value === "string" && APP_SIZES.includes(value as AppSize);

type DeploymentSummary = {
    appName : string,
    status : DeploymentStatus,
    appPort : number,
    appHost : string,
    size : AppSize,
    draining? : Draining,
};

interface BuildLayer {

    /* Moves a running app onto a different size of instance. The app is rolled
       as a deploy would roll it, so nothing in hand is lost. Returns undefined
       for an unknown app. */
    resize(appName : string, size : AppSize) : Promise<DeploymentSummary | undefined>;

    ensureHydrated() : Promise<void>;
    deploy(appName : string, appPort : number, tarball : Buffer) : DeploymentSummary;
    status(appName : string) : (DeploymentSummary & { log : Array<string> }) | undefined;
    list() : Array<DeploymentSummary>;
    ping(appName : string) : Promise<boolean>;
    logs(appName : string, signal : AbortSignal) : AsyncIterable<string>;
    /* Removes the app. One that is running its jobs is first drained, and the
       call returns as soon as that has begun - the summary says "draining" -
       so poll status until the app is gone. Returns undefined for an unknown
       app. */
    teardown(appName : string) : Promise<DeploymentSummary | undefined>;
    // Re-runs documentation generation for an already-deployed app from its
    // uploaded source, without redeploying it. Returns the number of docs written.
    regenerateDocs(appName : string) : Promise<number>;
    cleanUp() : Promise<void>;
    // Where a running app's queue consumers can be reached, so it can be asked
    // to drain; the hosting server supplies it from its consumer registry.
    consumerUrlsFor : (appName : string) => Array<string>;

    /* Called once an app is really gone, which for one that drained is some
       minutes after the teardown returned. Whatever outlives the app - its
       public address, in a hosted platform - is let go here, because this is
       the only moment both paths out of teardown pass through. */
    appRemoved : (appName : string) => void;

}

export type { BuildLayer, DeploymentStatus, DeploymentSummary, Draining, AppSize };
export { APP_SIZES, isAppSize };
