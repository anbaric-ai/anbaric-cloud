import {createServer, IncomingMessage, Server, ServerResponse} from "node:http";
import {AddressInfo} from "node:net";
import {JobPersistence, deserializeJob, serializeJob} from "anbaric-tsapi";
import {ConfirmableQueue} from "./ConfirmableQueue";

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

class HostingServer {

    private server : Server;

    constructor(private persistence : JobPersistence, private queue : ConfirmableQueue) {
        this.server = createServer((request, response) => {
            this.handle(request, response).catch(error => {
                const message = error instanceof Error ? error.message : "Internal error";
                const status = message.startsWith("No job found") ? 404 : 500;
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

        if (resource === "jobs") return this.handleJobs(method, id, subresource, url, request, response);
        if (resource === "queue" && method === "POST" && !subresource) return this.handleQueue(id, request, response);

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
