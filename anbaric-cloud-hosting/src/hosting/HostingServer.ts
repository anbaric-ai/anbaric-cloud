import {createServer, IncomingMessage, Server, ServerResponse} from "node:http";
import {AddressInfo} from "node:net";
import {JobPersistence, JsonStore, SecretStore} from "anbaric-tsapi";
import {BuildLayer} from "../app-management/BuildLayer";
import {AuditRecordStore} from "../auditing/AuditRecordStore";
import {Authenticator, SESSION_COOKIE} from "../auth/Authenticator";
import {CliAuthorizer} from "../auth/CliAuthorizer";
import {Tenant} from "../auth/Tenant";
import {TokenAuthenticator} from "../auth/TokenAuthenticator";
import {User} from "../auth/User";
import {ConfirmableQueue} from "../queuing/ConfirmableQueue";
import {ConsumerRegistry} from "../queuing/ConsumerRegistry";
import {Router} from "./Router";

const INTERNAL_RESOURCES = new Set(["jobs", "queue", "consumers", "state-machines", "documents", "secrets", "audits"]);

class HostingServer {

    private server : Server;
    private internalServer : Server;
    private router : Router;

    constructor(persistence : JobPersistence, queue : ConfirmableQueue,
                registry : ConsumerRegistry = new ConsumerRegistry(),
                buildLayer? : BuildLayer,
                documentStoreFor? : (collection : string) => JsonStore,
                secretStore? : SecretStore,
                private authenticator? : Authenticator,
                cliAuthorizer? : CliAuthorizer,
                private tokenAuthenticator? : TokenAuthenticator,
                private tenant? : string,
                auditRecords? : AuditRecordStore) {
        this.router = new Router(persistence, queue, registry, buildLayer, documentStoreFor, secretStore, cliAuthorizer, tenant, auditRecords);
        this.server = this.serverFor((request, response) => this.handle(request, response));
        this.internalServer = this.serverFor((request, response) => this.handleInternal(request, response));
    }

    listen(port : number) : Promise<number> {
        return new Promise(resolve =>
            this.server.listen(port, () => resolve((this.server.address() as AddressInfo).port)));
    }

    listenInternal(port : number) : Promise<number> {
        return new Promise(resolve =>
            this.internalServer.listen(port, () => resolve((this.internalServer.address() as AddressInfo).port)));
    }

    close() : Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.internalServer.listening) this.internalServer.close();
            this.server.close(error => error ? reject(error) : resolve());
        });
    }

    private serverFor(handle : (request : IncomingMessage, response : ServerResponse) => Promise<void>) : Server {
        return createServer((request, response) => {
            handle(request, response).catch(error => {
                const message = error instanceof Error ? error.message : "Internal error";
                const status = /^No .+ found/.test(message) ? 404 : 500;
                this.reply(response, status, { error: message });
            });
        });
    }

    private async handle(request : IncomingMessage, response : ServerResponse) : Promise<void> {
        const path = request.url?.split("?")[0] ?? "/";
        if (path === "/ping" && request.method === "GET") {
            return this.reply(response, 200, this.tenant ? { status: "ok", tenant: this.tenant } : { status: "ok" });
        }
        if (/^\/authorize-cli\/[^/]+\/poll$/.test(path) && request.method === "GET") {
            return this.router.route(request, response);
        }

        if (this.tokenAuthenticator?.handles(request)) {
            const user = await this.tokenAuthenticator.authenticate(request, response);
            if (!user) return;
            return this.authorizeAndRoute(user, undefined, request, response);
        }

        const authenticated = await this.authenticateSession(request, response);
        if (this.authenticator && !authenticated) return;
        if (authenticated) return this.authorizeAndRoute(authenticated[0], authenticated[1], request, response);

        await this.router.route(request, response);
    }

    private async handleInternal(request : IncomingMessage, response : ServerResponse) : Promise<void> {
        const path = request.url?.split("?")[0] ?? "/";
        if (path === "/ping" && request.method === "GET") {
            return this.reply(response, 200, this.tenant ? { status: "ok", tenant: this.tenant } : { status: "ok" });
        }
        const [resource] = path.split("/").filter(Boolean);
        if (!resource || !INTERNAL_RESOURCES.has(resource)) {
            return this.reply(response, 404, { error: "Not found" });
        }
        await this.router.route(request, response);
    }

    private async authorizeAndRoute(user : User, tenant : Tenant | undefined,
                                    request : IncomingMessage, response : ServerResponse) : Promise<void> {
        if (this.authenticator) {
            const permitted = await this.authenticator.authorize(user, request, response);
            if (!permitted) {
                if (!response.writableEnded) this.reply(response, 403, { error: "Not authorized" });
                return;
            }
        }
        await this.router.route(request, response, user, tenant);
    }

    private async authenticateSession(request : IncomingMessage, response : ServerResponse) : Promise<[User, Tenant] | undefined> {
        if (!this.authenticator) return undefined;
        return this.authenticator.authenticate(this.sessionCookie(request), request, response);
    }

    private sessionCookie(request : IncomingMessage) : string | undefined {
        const cookies = String(request.headers.cookie ?? "").split(";");
        for (const cookie of cookies) {
            const [name, ...value] = cookie.trim().split("=");
            if (name === SESSION_COOKIE) return value.join("=");
        }
        return undefined;
    }

    private reply(response : ServerResponse, status : number, body : unknown) : void {
        response.writeHead(status, { "content-type": "application/json" });
        response.end(JSON.stringify(body));
    }

}

export { HostingServer }
