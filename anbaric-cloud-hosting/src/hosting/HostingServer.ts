import {JobPersistence, JsonStore, SecretStore} from "anbaric-tsapi";
import {BuildLayer} from "../app-management/BuildLayer";
import {AuditRecordStore} from "../auditing/AuditRecordStore";
import {Authenticator} from "../auth/Authenticator";
import {CliAuthorizer} from "../auth/CliAuthorizer";
import {TokenAuthenticator} from "../auth/TokenAuthenticator";
import {ConfirmableQueue} from "../queuing/ConfirmableQueue";
import {ConsumerRegistry} from "../queuing/ConsumerRegistry";
import {AppProxyHandler} from "./handlers/AppProxyHandler";
import {AppsHandler} from "./handlers/AppsHandler";
import {AuditsHandler} from "./handlers/AuditsHandler";
import {AuthorizeCliHandler} from "./handlers/auth/AuthorizeCliHandler";
import {KeysHandler} from "./handlers/auth/KeysHandler";
import {SessionsHandler} from "./handlers/auth/SessionsHandler";
import {WhoamiHandler} from "./handlers/auth/WhoamiHandler";
import {ConsumersHandler} from "./handlers/ConsumersHandler";
import {DocumentsHandler} from "./handlers/DocumentsHandler";
import {JobsHandler} from "./handlers/JobsHandler";
import {PagesHandler} from "./handlers/PagesHandler";
import {PingHandler} from "./handlers/PingHandler";
import {QueueHandler} from "./handlers/QueueHandler";
import {SecretsHandler} from "./handlers/SecretsHandler";
import {StateMachinesHandler} from "./handlers/StateMachinesHandler";
import {PluginsHandler} from "./handlers/PluginsHandler";
import {AuthenticationMiddleware} from "./middleware/AuthenticationMiddleware";
import {SessionMiddleware} from "./middleware/SessionMiddleware";
import {LoadedPlugin} from "../plugins/Plugin";
import {Request} from "./Request";
import {Router} from "./Router";
import {Server} from "./Server";

const CLI_KEY_POLL = /^\/authorize-cli\/[^/]+\/poll$/;

/* The composition root: builds the handlers from the platform's
   collaborators, registers them on the public and internal routers, and
   runs one Server per entry point. The public server authenticates through
   its middleware chain; the internal server exposes only the workflow
   handlers, unauthenticated, and must never be publicly reachable. */
class HostingServer {

    private publicServer : Server;
    private internalServer : Server;

    constructor(persistence : JobPersistence, queue : ConfirmableQueue,
                registry : ConsumerRegistry = new ConsumerRegistry(),
                buildLayer? : BuildLayer,
                documentStoreFor? : (collection : string) => JsonStore,
                secretStore? : SecretStore,
                authenticator? : Authenticator,
                cliAuthorizer? : CliAuthorizer,
                tokenAuthenticator? : TokenAuthenticator,
                tenant? : string,
                auditRecords? : AuditRecordStore,
                plugins : Array<LoadedPlugin> = []) {
        const pages = new PagesHandler();
        const ping = new PingHandler(tenant);
        const jobs = new JobsHandler(persistence);
        const queueHandler = new QueueHandler(queue);
        const consumers = new ConsumersHandler(registry);
        const stateMachines = new StateMachinesHandler(registry);
        const documents = documentStoreFor && new DocumentsHandler(documentStoreFor);
        const secrets = secretStore && new SecretsHandler(secretStore);
        const audits = auditRecords && new AuditsHandler(auditRecords);
        const sessions = new SessionsHandler();

        const publicRouter = new Router();
        publicRouter.registerRoot(pages);
        publicRouter.register("ping", ping);
        if (plugins.length > 0) publicRouter.registerApi("plugins", new PluginsHandler(plugins));
        publicRouter.registerApi("whoami", new WhoamiHandler());
        publicRouter.registerApi("sessions", sessions);
        publicRouter.registerApi("jobs", jobs);
        publicRouter.registerApi("queue", queueHandler);
        publicRouter.registerApi("consumers", consumers);
        publicRouter.registerApi("state-machines", stateMachines);
        if (documents) publicRouter.registerApi("documents", documents);
        if (secrets) publicRouter.registerApi("secrets", secrets);
        if (audits) publicRouter.registerApi("audits", audits);
        if (cliAuthorizer) {
            publicRouter.register("authorize-cli", new AuthorizeCliHandler(cliAuthorizer, pages, tenant));
            publicRouter.registerApi("keys", new KeysHandler(cliAuthorizer));
        }
        if (buildLayer) {
            publicRouter.registerApi("apps", new AppsHandler(buildLayer));
            publicRouter.register("app", new AppProxyHandler(buildLayer));
        }

        const internalRouter = new Router();
        internalRouter.register("ping", ping);
        internalRouter.registerApi("sessions", sessions);
        internalRouter.registerApi("jobs", jobs);
        internalRouter.registerApi("queue", queueHandler);
        internalRouter.registerApi("consumers", consumers);
        internalRouter.registerApi("state-machines", stateMachines);
        if (documents) internalRouter.registerApi("documents", documents);
        if (secrets) internalRouter.registerApi("secrets", secrets);
        if (audits) internalRouter.registerApi("audits", audits);

        const openRequests = (request : Request) =>
            request.url.pathname === "/ping" ||
            (request.method === "GET" && CLI_KEY_POLL.test(request.url.pathname));

        this.publicServer = new Server(publicRouter, [
            new SessionMiddleware(),
            new AuthenticationMiddleware(authenticator, tokenAuthenticator, openRequests),
        ]);
        this.internalServer = new Server(internalRouter);
    }

    listen(port : number) : Promise<number> {
        return this.publicServer.listen(port);
    }

    listenInternal(port : number) : Promise<number> {
        return this.internalServer.listen(port);
    }

    async close() : Promise<void> {
        if (this.internalServer.listening) await this.internalServer.close();
        if (this.publicServer.listening) await this.publicServer.close();
    }

}

export { HostingServer }
