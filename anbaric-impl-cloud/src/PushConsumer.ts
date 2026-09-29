import {createServer, IncomingMessage, Server, ServerResponse} from "node:http";
import {AddressInfo} from "node:net";
import {Consumer, QueueMessage} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient.js";

type ProcessJob = (jobId : string) => Promise<void>;

/* How long a consumer told to stop by a signal keeps the process alive for
   the work it has in hand. Under the platform's own drain the signal only
   arrives once the work is done; on its own it is bounded by the 120 seconds a
   Fargate task is given to stop, with a little kept back for the exit. */
const DRAIN_ON_SIGNAL_MS = 110_000;
const IDLE_POLL_MS = 250;

const readBody = (request : IncomingMessage) : Promise<any> =>
    new Promise((resolve, reject) => {
        const chunks : Array<Buffer> = [];
        request.on("data", chunk => chunks.push(chunk));
        request.on("error", reject);
        request.on("end", () => {
            const raw = Buffer.concat(chunks).toString();
            try {
                resolve(raw.length === 0 ? undefined : JSON.parse(raw));
            } catch (error) {
                reject(error);
            }
        });
    });

/* The app-side end of the platform's queue: the platform pushes batches of
   messages to this consumer's URL, and each is confirmed the moment the
   consumer takes it on - from then on the job is the app's.

   A consumer can be told to drain, by the platform ahead of replacing the app
   or by a signal: it stops accepting pushes (they are refused unconfirmed, so
   the platform offers them to whatever replaces this app) and finishes the
   steps it already has in hand, which it counts and reports on /health. */
class PushConsumer implements Consumer {

    private subscribers = new Map<string, ProcessJob>();
    private client : CloudApiClient;
    private server? : Server;
    private listening? : Promise<void>;
    private boundPort? : number;
    private draining = false;
    private inFlightSteps = 0;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl(),
                private listenPort : number = Number(process.env.ANBARIC_CONSUMER_PORT ?? 8788),
                private drainOnSignals : Array<NodeJS.Signals> = process.env.ANBARIC_CONSUMER_URL ? ["SIGTERM"] : []) {
        this.client = new CloudApiClient(baseUrl);
    }

    get port() : number | undefined {
        return this.boundPort;
    }

    get inFlight() : number {
        return this.inFlightSteps;
    }

    get isDraining() : boolean {
        return this.draining;
    }

    // Subscribers are keyed by the (appId, workflowId) composite, encoded as a
    // tuple so an app and a machine id can never collide.
    private key(appId : string | undefined, workflowId : string) : string {
        return JSON.stringify([appId || null, workflowId]);
    }

    subscribe(appId : string | undefined, workflowId : string, processJob : ProcessJob) : void {
        this.subscribers.set(this.key(appId, workflowId), processJob);
        if (!this.server) {
            this.listening = this.listen();
            for (const signal of this.drainOnSignals) process.once(signal, () => void this.drainThenExit());
        }
        void this.register(appId, workflowId);
    }

    private async register(appId : string | undefined, workflowId : string) : Promise<void> {
        try {
            await this.listening;
            const url = process.env.ANBARIC_CONSUMER_URL ?? `http://localhost:${this.boundPort}`;
            await this.client.request("POST", "/consumers", { appId, workflowId, url });
        } catch {
        }
    }

    // Stops taking on new messages; what is already in hand runs to the end.
    drain() : void {
        this.draining = true;
    }

    // Resolves once nothing is in flight, or at the deadline.
    async drained(timeoutMs : number = DRAIN_ON_SIGNAL_MS) : Promise<boolean> {
        const deadline = Date.now() + timeoutMs;
        while (this.inFlightSteps > 0 && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, IDLE_POLL_MS));
        }
        return this.inFlightSteps === 0;
    }

    private async drainThenExit() : Promise<void> {
        this.drain();
        const idle = await this.drained();
        if (! idle) console.error(`[anbaric] stopping with ${this.inFlightSteps} step(s) still in flight after ${DRAIN_ON_SIGNAL_MS / 1000}s`);
        process.exit(0);
    }

    async cleanUp() : Promise<void> {
        this.subscribers.clear();
        if (!this.server) return;
        await this.listening;
        await new Promise<void>((resolve, reject) =>
            this.server!.close(error => error ? reject(error) : resolve()));
        this.server = undefined;
        this.boundPort = undefined;
    }

    private listen() : Promise<void> {
        this.server = createServer((request, response) => {
            this.handle(request, response).catch(error => {
                const message = error instanceof Error ? error.message : "Internal error";
                this.reply(response, 500, { error: message });
            });
        });
        return new Promise(resolve => this.server!.listen(this.listenPort, () => {
            this.boundPort = (this.server!.address() as AddressInfo).port;
            resolve();
        }));
    }

    private async handle(request : IncomingMessage, response : ServerResponse) : Promise<void> {
        const url = new URL(request.url ?? "/", "http://localhost");

        if (request.method === "GET" && url.pathname === "/health") {
            return this.reply(response, 200, this.health());
        }

        if (request.method === "POST" && url.pathname === "/drain") {
            this.drain();
            return this.reply(response, 200, this.health());
        }

        if (request.method === "POST" && url.pathname === "/process") {
            if (this.draining) return this.reply(response, 503, { error: "Draining: not accepting new messages", ...this.health() });

            const body = await readBody(request);
            if (!body || !Array.isArray(body.messages)) {
                return this.reply(response, 400, { error: "Expected a body of { messages : Array<QueueMessage> }" });
            }
            const messages = body.messages as Array<QueueMessage>;
            this.reply(response, 202, { accepted: messages.map(message => message.jobId) });
            void this.processAll(messages);
            return;
        }

        this.reply(response, 404, { error: "Not found" });
    }

    private health() : { draining : boolean, inFlight : number } {
        return { draining: this.draining, inFlight: this.inFlightSteps };
    }

    /* A message is confirmed as soon as this consumer takes it on, not when the
       work finishes: from then on the job is the app's, and the platform never
       offers it again. The queue's lease only guards against two dispatchers
       claiming the same row at once; it says nothing about how long the work
       takes, so confirming at the end would hand a long step out again while
       it was still running. What protects work in hand is draining: the
       platform asks before replacing the app, and a signal asks on the way
       out. */
    private async processAll(messages : Array<QueueMessage>) : Promise<void> {
        for (const message of messages) {
            const processJob = this.subscribers.get(this.key(message.appId, message.workflowId));
            if (!processJob) continue;
            if (this.draining) continue;

            try {
                await this.client.request("POST", "/queue/confirm", message);
            } catch {
                // Unconfirmed, so the platform will offer it again; don't start
                // work that would then be duplicated by that redelivery.
                continue;
            }

            this.inFlightSteps++;
            try {
                await processJob(message.jobId);
            } catch {
                // The state machine records a failed job; the queue is done here.
            } finally {
                this.inFlightSteps--;
            }
        }
    }

    private reply(response : ServerResponse, status : number, body? : unknown) : void {
        if (body === undefined) {
            response.statusCode = status;
            response.end();
            return;
        }
        response.writeHead(status, { "content-type": "application/json" });
        response.end(JSON.stringify(body));
    }

}

export { PushConsumer }
