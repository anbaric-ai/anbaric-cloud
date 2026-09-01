import {createServer, IncomingMessage, Server, ServerResponse} from "node:http";
import {AddressInfo} from "node:net";
import {Consumer, QueueMessage} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient";

type ProcessJob = (jobId : string) => Promise<void>;

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

class PushConsumer implements Consumer {

    private subscribers = new Map<string, ProcessJob>();
    private client : CloudApiClient;
    private server? : Server;
    private listening? : Promise<void>;
    private boundPort? : number;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl(),
                private listenPort : number = Number(process.env.ANBARIC_CONSUMER_PORT ?? 8788)) {
        this.client = new CloudApiClient(baseUrl);
    }

    get port() : number | undefined {
        return this.boundPort;
    }

    // Subscribers are keyed by the (appId, workflowId) composite, encoded as a
    // tuple so an app and a machine id can never collide.
    private key(appId : string | undefined, workflowId : string) : string {
        return JSON.stringify([appId || null, workflowId]);
    }

    subscribe(appId : string | undefined, workflowId : string, processJob : ProcessJob) : void {
        this.subscribers.set(this.key(appId, workflowId), processJob);
        if (!this.server) this.listening = this.listen();
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

        if (request.method === "POST" && url.pathname === "/process") {
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

    private async processAll(messages : Array<QueueMessage>) : Promise<void> {
        for (const message of messages) {
            const processJob = this.subscribers.get(this.key(message.appId, message.workflowId));
            if (!processJob) continue;
            try {
                await processJob(message.jobId);
                await this.client.request("POST", "/queue/confirm", message);
            } catch {
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
