import {createServer, IncomingMessage, Server, ServerResponse} from "node:http";
import {AddressInfo} from "node:net";
import {JobPersistence, JsonStore, deserializeJob, serializeJob} from "anbaric-tsapi";
import {BuildLayer} from "./BuildLayer";
import {ConfirmableQueue} from "./ConfirmableQueue";
import {ConsumerRegistry} from "./ConsumerRegistry";

const readRawBody = (request : IncomingMessage) : Promise<Buffer> =>
    new Promise((resolve, reject) => {
        const chunks : Array<Buffer> = [];
        request.on("data", chunk => chunks.push(chunk));
        request.on("error", reject);
        request.on("end", () => resolve(Buffer.concat(chunks)));
    });

const readBody = async (request : IncomingMessage) : Promise<any> => {
    const raw = (await readRawBody(request)).toString();
    return raw.length === 0 ? undefined : JSON.parse(raw);
};

class HostingServer {

    private server : Server;

    constructor(private persistence : JobPersistence, private queue : ConfirmableQueue,
                private registry : ConsumerRegistry = new ConsumerRegistry(),
                private buildLayer? : BuildLayer,
                private documentStoreFor? : (collection : string) => JsonStore) {
        this.server = createServer((request, response) => {
            this.handle(request, response).catch(error => {
                const message = error instanceof Error ? error.message : "Internal error";
                const status = /^No .+ found/.test(message) ? 404 : 500;
                this.reply(response, status, { error: message });
            });
        });
    }

    listen(port : number) : Promise<number> {
        return new Promise(resolve =>
            this.server.listen(port, () => resolve((this.server.address() as AddressInfo).port)));
    }

    close() : Promise<void> {
        return new Promise((resolve, reject) =>
            this.server.close(error => error ? reject(error) : resolve()));
    }

    private async handle(request : IncomingMessage, response : ServerResponse) : Promise<void> {
        const url = new URL(request.url ?? "/", "http://localhost");
        const [resource, id, subresource] = url.pathname.split("/").filter(Boolean);
        const method = request.method ?? "GET";

        if (resource === "ping" && method === "GET") {
            return this.reply(response, 200, { status: "ok" });
        }
        if (resource === "jobs") return this.handleJobs(method, id, subresource, url, request, response);
        if (resource === "queue" && method === "POST" && !subresource) return this.handleQueue(id, request, response);
        if (resource === "consumers" && method === "POST" && !id) {
            const { workflowId, url: consumerUrl } = await readBody(request);
            this.registry.register(workflowId, consumerUrl);
            return this.reply(response, 204);
        }
        if (resource === "apps" && this.buildLayer) {
            return this.handleApps(method, id, subresource, url, request, response);
        }
        if (resource === "state-machines" && method === "GET" && !id) {
            return this.reply(response, 200, this.registry.list());
        }
        if (resource === "documents" && id && this.documentStoreFor) {
            return this.handleDocuments(method, this.documentStoreFor(id), subresource, url, request, response);
        }
        if (resource && this.buildLayer) {
            const app = this.buildLayer.status(resource);
            if (app && app.status === "running") {
                return this.forwardToApp(app.appPort, resource, method, url, request, response);
            }
        }

        this.reply(response, 404, { error: "Not found" });
    }

    private async forwardToApp(appPort : number, appName : string, method : string, url : URL,
                               request : IncomingMessage, response : ServerResponse) : Promise<void> {
        const appPath = url.pathname.slice(`/${appName}`.length) || "/";
        const body = method === "GET" || method === "HEAD" ? undefined : await readRawBody(request);

        const upstream = await fetch(`http://localhost:${appPort}${appPath}${url.search}`, {
            method,
            headers: { "content-type": String(request.headers["content-type"] ?? "application/json") },
            body: body && body.length > 0 ? new Uint8Array(body) : undefined,
        });

        const payload = Buffer.from(await upstream.arrayBuffer());
        response.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") ?? "application/octet-stream" });
        response.end(payload);
    }

    private async handleDocuments(method : string, store : JsonStore, documentId : string | undefined,
                                  url : URL, request : IncomingMessage, response : ServerResponse) : Promise<void> {
        if (!documentId && method === "GET") {
            const pageSize = Number(url.searchParams.get("pageSize") ?? 100);
            const page = Number(url.searchParams.get("page") ?? 0);
            return this.reply(response, 200, await store.list(pageSize, page));
        }

        if (documentId) {
            if (method === "PUT") {
                await store.save(documentId, await readBody(request));
                return this.reply(response, 204);
            }
            if (method === "GET") {
                return this.reply(response, 200, await store.retrieve(documentId));
            }
            if (method === "DELETE") {
                await store.delete(documentId);
                return this.reply(response, 204);
            }
        }

        this.reply(response, 404, { error: "Not found" });
    }

    private async handleApps(method : string, appName : string | undefined, subresource : string | undefined,
                             url : URL, request : IncomingMessage, response : ServerResponse) : Promise<void> {
        if (method === "GET" && !appName) {
            return this.reply(response, 200, this.buildLayer!.list());
        }

        if (!appName) return this.reply(response, 404, { error: "Not found" });

        if (method === "POST" && subresource === "deploy") {
            const appPort = Number(url.searchParams.get("port"));
            if (!Number.isInteger(appPort) || appPort <= 0) {
                return this.reply(response, 400, { error: "Expected a numeric port query parameter" });
            }
            const tarball = await readRawBody(request);
            if (tarball.length === 0) return this.reply(response, 400, { error: "Expected a gzipped tarball body" });
            return this.reply(response, 202, this.buildLayer!.deploy(appName, appPort, tarball));
        }

        if (method === "GET" && !subresource) {
            const status = this.buildLayer!.status(appName);
            if (!status) return this.reply(response, 404, { error: `No app named "${appName}"` });
            return this.reply(response, 200, status);
        }

        this.reply(response, 404, { error: "Not found" });
    }

    private async handleJobs(method : string, id : string | undefined, subresource : string | undefined,
                             url : URL, request : IncomingMessage, response : ServerResponse) : Promise<void> {
        if (!id && method === "GET") {
            const pageSize = Number(url.searchParams.get("pageSize") ?? 100);
            const page = Number(url.searchParams.get("page") ?? 0);
            const jobs = await this.persistence.list(pageSize, page);
            return this.reply(response, 200, jobs.map(serializeJob));
        }

        if (id && !subresource) {
            if (method === "PUT") {
                await this.persistence.save(deserializeJob(await readBody(request)));
                return this.reply(response, 204);
            }
            if (method === "GET") {
                const job = await this.persistence.retrieve(id);
                return this.reply(response, 200, serializeJob(job));
            }
            if (method === "DELETE") {
                await this.persistence.delete(id);
                return this.reply(response, 204);
            }
        }

        if (id && subresource === "properties" && method === "PATCH") {
            const properties = new Map<string, any>(Object.entries(await readBody(request)));
            await this.persistence.updateProperties(id, properties);
            return this.reply(response, 204);
        }

        this.reply(response, 404, { error: "Not found" });
    }

    private async handleQueue(operation : string | undefined, request : IncomingMessage,
                              response : ServerResponse) : Promise<void> {
        if (operation === "enqueue") {
            const { jobId, workflowId } = await readBody(request);
            await this.queue.enqueue(jobId, workflowId);
            return this.reply(response, 204);
        }

        if (operation === "schedule") {
            const { jobId, workflowId, due } = await readBody(request);
            await this.queue.schedule(jobId, workflowId, new Date(due));
            return this.reply(response, 204);
        }

        if (operation === "dequeue") {
            return this.reply(response, 200, { messages: await this.queue.dequeueSome() });
        }

        if (operation === "confirm") {
            const { jobId, workflowId } = await readBody(request);
            await this.queue.confirm({ jobId, workflowId });
            return this.reply(response, 204);
        }

        this.reply(response, 404, { error: "Not found" });
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

export { HostingServer }
