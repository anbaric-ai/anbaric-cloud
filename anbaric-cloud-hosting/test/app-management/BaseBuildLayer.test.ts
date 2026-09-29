import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {BaseBuildLayer, Deployment} from "../../src/app-management/BaseBuildLayer";

/* A consumer as an app would run it: told to drain, it reports what it has in
   hand, and the test decides when that reaches zero. */
const startConsumer = () : Promise<{ server : Server, url : string, drains : number, setInFlight : (count : number) => void }> =>
    new Promise(resolve => {
        const state = { drains: 0, inFlight: 0 };
        const server = createServer((request, response) => {
            if (request.method === "POST" && request.url === "/drain") state.drains++;
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify({ draining: state.drains > 0, inFlight: state.inFlight }));
        });
        server.listen(0, () => resolve({
            server,
            url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
            get drains() { return state.drains; },
            setInFlight: (count : number) => { state.inFlight = count; },
        }));
    });

class StubBuildLayer extends BaseBuildLayer {

    stopped : Array<string> = [];

    constructor(appsDir : string, drainTimeoutMs : number) {
        super(appsDir, 8800, async () => true, 1_000, drainTimeoutMs, 20);
    }

    running(appName : string) : Deployment {
        const deployment : Deployment = {
            appName, status: "running", appPort: 3000, appHost: appName, adminPort: 8791, consumerPort: 8800, log: [],
        };
        this.deployments.set(appName, deployment);
        return deployment;
    }

    drainFor(shown : Deployment, running : Deployment) : Promise<void> {
        return this.drain(shown, running);
    }

    protected appHostFor(appName : string) : string { return appName; }
    protected async start() : Promise<void> {}
    protected async stop(deployment : Deployment) : Promise<void> { this.stopped.push(deployment.appName); }
    protected async *streamLogs() : AsyncIterable<string> {}
    protected async sourceDir() : Promise<{ dir : string, cleanup : () => Promise<void> }> { return { dir: "", cleanup: async () => {} }; }

}

describe("BaseBuildLayer draining", () => {

    let appsDir : string;
    let consumer : Awaited<ReturnType<typeof startConsumer>>;

    beforeEach(async () => {
        appsDir = await mkdtemp(join(tmpdir(), "anbaric-drain-"));
        consumer = await startConsumer();
    });

    afterEach(async () => {
        await new Promise<void>(resolve => consumer.server.close(() => resolve()));
        await rm(appsDir, { recursive: true, force: true });
    });

    it("tells the app's consumers to drain, waits for nothing to be in flight, and shows the wait", async () => {
        const layer = new StubBuildLayer(appsDir, 5_000);
        layer.consumerUrlsFor = () => [consumer.url];
        const running = layer.running("crm");
        consumer.setInFlight(2);

        const draining = layer.drainFor(running, running);
        await vi.waitFor(() => expect(layer.status("crm")?.status).toBe("draining"));
        await vi.waitFor(() => expect(layer.status("crm")?.draining?.inFlight).toBe(2));

        consumer.setInFlight(0);
        await draining;

        expect(consumer.drains).toBe(1);
        expect(layer.status("crm")?.status).toBe("running");
        expect(layer.status("crm")?.draining).toBeUndefined();
        expect(layer.status("crm")?.log.at(-1)).toBe("drained: nothing in flight");
    });

    it("goes ahead at the deadline when work is still in flight", async () => {
        const layer = new StubBuildLayer(appsDir, 100);
        layer.consumerUrlsFor = () => [consumer.url];
        const running = layer.running("crm");
        consumer.setInFlight(1);

        await layer.drainFor(running, running);

        expect(layer.status("crm")?.log.at(-1)).toMatch(/drain timed out after 0.1s with 1 step\(s\) in flight; going ahead/);
    });

    it("does nothing for an app with no consumers to ask", async () => {
        const layer = new StubBuildLayer(appsDir, 5_000);
        const running = layer.running("crm");

        await layer.drainFor(running, running);

        expect(consumer.drains).toBe(0);
        expect(layer.status("crm")?.log).toEqual([]);
    });

    it("tears a running app down only once it has drained, answering draining meanwhile", async () => {
        const layer = new StubBuildLayer(appsDir, 5_000);
        layer.consumerUrlsFor = () => [consumer.url];
        layer.running("crm");
        consumer.setInFlight(1);

        const answer = await layer.teardown("crm");

        expect(answer?.status).toBe("draining");
        expect(layer.stopped).toEqual([]);
        consumer.setInFlight(0);
        await vi.waitFor(() => expect(layer.stopped).toEqual(["crm"]));
        await vi.waitFor(() => expect(layer.status("crm")).toBeUndefined());
    });

    it("tears an idle app down at once", async () => {
        const layer = new StubBuildLayer(appsDir, 5_000);
        layer.running("crm");

        const answer = await layer.teardown("crm");

        expect(answer?.status).toBe("stopped");
        expect(layer.stopped).toEqual(["crm"]);
        expect(layer.status("crm")).toBeUndefined();
    });

});
