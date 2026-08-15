import {readFile} from "node:fs/promises";
import {IncomingMessage, ServerResponse} from "node:http";
import {JobPersistence, JsonStore, SecretStore, deserializeJob, serializeJob} from "anbaric-tsapi";
import {BuildLayer} from "../app-management/BuildLayer";
import {CliAuthorizer} from "../auth/CliAuthorizer";
import {User} from "../auth/User";
import {ConfirmableQueue} from "../queuing/ConfirmableQueue";
import {ConsumerRegistry} from "../queuing/ConsumerRegistry";

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

class Router {

    constructor(private persistence : JobPersistence, private queue : ConfirmableQueue,
                private registry : ConsumerRegistry,
                private buildLayer? : BuildLayer,
                private documentStoreFor? : (collection : string) => JsonStore,
                private secretStore? : SecretStore,
                private cliAuthorizer? : CliAuthorizer,
                private tenant? : string) {}

    async route(request : IncomingMessage, response : ServerResponse, user? : User) : Promise<void> {
        const url = new URL(request.url ?? "/", "http://localhost");
        const [resource, id, subresource] = url.pathname.split("/").filter(Boolean);
        const method = request.method ?? "GET";

        if (!resource && method === "GET") {
            return this.servePage(response);
        }
        if (resource === "authorize-cli" && id && this.cliAuthorizer) {
            return this.handleAuthorizeCli(method, id, subresource, request, response, user);
        }
        if (resource === "manage-keys" && method === "GET" && !id && this.cliAuthorizer) {
            return this.servePage(response);
        }
        if (resource === "keys" && this.cliAuthorizer) {
            return this.handleKeys(method, id, response, user);
        }
        if (resource === "whoami" && method === "GET" && !id) {
            if (!user) return this.reply(response, 404, { error: "Not found" });
            return this.reply(response, 200, { id: user.id, roles: user.roles.map(role => role.id) });
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
        if (resource === "secrets" && this.secretStore && !subresource) {
            return this.handleSecrets(method, id, request, response);
        }
        if (resource && this.buildLayer) {
            const app = this.buildLayer.status(resource);
            if (app && app.status === "running") {
                return this.forwardToApp(app.appHost, app.appPort, resource, method, url, request, response);
            }
        }

        this.reply(response, 404, { error: "Not found" });
    }

    private async handleAuthorizeCli(method : string, requestId : string, subresource : string | undefined,
                                     request : IncomingMessage, response : ServerResponse, user? : User) : Promise<void> {
        if (method === "GET" && subresource === "poll") {
            const keyPair = this.cliAuthorizer!.collect(requestId);
            if (!keyPair) return this.reply(response, 202, { status: "pending" });
            return this.reply(response, 200, this.tenant ? { ...keyPair, tenant: this.tenant } : keyPair);
        }

        if (method === "GET" && !subresource) {
            return this.servePage(response);
        }

        if (method === "POST" && !subresource) {
            const { clientName } = await readBody(request);
            if (typeof clientName !== "string" || clientName.trim().length === 0) {
                return this.reply(response, 400, { error: "Expected a body of { clientName : string }" });
            }
            await this.cliAuthorizer!.approve(requestId, clientName.trim(), user ?? new User("local"));
            return this.reply(response, 204);
        }

        this.reply(response, 404, { error: "Not found" });
    }

    private async handleKeys(method : string, id : string | undefined,
                             response : ServerResponse, user? : User) : Promise<void> {
        const owner = user ?? new User("local");

        if (method === "GET" && !id) {
            const keys = await this.cliAuthorizer!.keysFor(owner.id);
            return this.reply(response, 200, keys.map(key => ({
                id: key.id,
                clientName: key.clientName,
                createdAt: key.createdAt.toISOString(),
            })));
        }

        if (method === "DELETE" && id) {
            await this.cliAuthorizer!.revoke(id, owner.id);
            return this.reply(response, 204);
        }

        this.reply(response, 404, { error: "Not found" });
    }

    private async servePage(response : ServerResponse) : Promise<void> {
        try {
            const page = await readFile(new URL("./pages/platform-ui.html", import.meta.url));
            response.writeHead(200, { "content-type": "text/html" });
            response.end(page);
        } catch {
            this.reply(response, 501, { error: "The platform UI has not been built - run npm run build in anbaric-cloud-hosting/ui" });
        }
    }

    private async forwardToApp(appHost : string, appPort : number, appName : string, method : string, url : URL,
                               request : IncomingMessage, response : ServerResponse) : Promise<void> {
        const appPath = url.pathname.slice(`/${appName}`.length) || "/";
        const body = method === "GET" || method === "HEAD" ? undefined : await readRawBody(request);

        const upstream = await fetch(`http://${appHost}:${appPort}${appPath}${url.search}`, {
            method,
            headers: { "content-type": String(request.headers["content-type"] ?? "application/json") },
            body: body && body.length > 0 ? new Uint8Array(body) : undefined,
        });

        const payload = Buffer.from(await upstream.arrayBuffer());
        response.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") ?? "application/octet-stream" });
        response.end(payload);
    }

    private async handleSecrets(method : string, name : string | undefined,
                                request : IncomingMessage, response : ServerResponse) : Promise<void> {
        if (!name && method === "GET") {
            return this.reply(response, 200, await this.secretStore!.list());
        }

        if (name) {
            if (method === "PUT") {
                const { value } = await readBody(request);
                if (typeof value !== "string") return this.reply(response, 400, { error: "Expected a body of { value : string }" });
                await this.secretStore!.save(name, value);
                return this.reply(response, 204);
            }
            if (method === "GET") {
                return this.reply(response, 200, { value: await this.secretStore!.retrieve(name) });
            }
            if (method === "DELETE") {
                await this.secretStore!.delete(name);
                return this.reply(response, 204);
            }
        }

        this.reply(response, 404, { error: "Not found" });
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

export { Router }
