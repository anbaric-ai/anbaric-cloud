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
import {WhoamiHandler} from "./handlers/auth/WhoamiHandler";
import {ConsumersHandler} from "./handlers/ConsumersHandler";
import {DocumentsHandler} from "./handlers/DocumentsHandler";
import {JobsHandler} from "./handlers/JobsHandler";
import {PagesHandler} from "./handlers/PagesHandler";
import {PingHandler} from "./handlers/PingHandler";
import {QueueHandler} from "./handlers/QueueHandler";
import {SecretsHandler} from "./handlers/SecretsHandler";
import {StateMachinesHandler} from "./handlers/StateMachinesHandler";
import {AuthenticationMiddleware} from "./middleware/AuthenticationMiddleware";
import {SessionMiddleware} from "./middleware/SessionMiddleware";
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
                auditRecords? : AuditRecordStore) {
        const pages = new PagesHandler();
        const ping = new PingHandler(tenant);
        const jobs = new JobsHandler(persistence);
        const queueHandler = new QueueHandler(queue);
        const consumers = new ConsumersHandler(registry);
        const stateMachines = new StateMachinesHandler(registry);
        const documents = documentStoreFor && new DocumentsHandler(documentStoreFor);
        const secrets = secretStore && new SecretsHandler(secretStore);
        const audits = auditRecords && new AuditsHandler(auditRecords);

        const publicRouter = new Router();
        publicRouter.registerRoot(pages);
        publicRouter.register("ping", ping);
        publicRouter.register("audit", pages);
        publicRouter.register("whoami", new WhoamiHandler());
        publicRouter.register("jobs", jobs);
        publicRouter.register("queue", queueHandler);
        publicRouter.register("consumers", consumers);
        publicRouter.register("state-machines", stateMachines);
        if (documents) publicRouter.register("documents", documents);
        if (secrets) publicRouter.register("secrets", secrets);
        if (audits) publicRouter.register("audits", audits);
        if (cliAuthorizer) {
            publicRouter.register("authorize-cli", new AuthorizeCliHandler(cliAuthorizer, pages, tenant));
            publicRouter.register("keys", new KeysHandler(cliAuthorizer));
            publicRouter.register("manage-keys", pages);
        }
        if (buildLayer) {
            publicRouter.register("apps", new AppsHandler(buildLayer));
            publicRouter.registerFallback(new AppProxyHandler(buildLayer));
        }

        const internalRouter = new Router();
        internalRouter.register("ping", ping);
        internalRouter.register("jobs", jobs);
        internalRouter.register("queue", queueHandler);
        internalRouter.register("consumers", consumers);
        internalRouter.register("state-machines", stateMachines);
        if (documents) internalRouter.register("documents", documents);
        if (secrets) internalRouter.register("secrets", secrets);
        if (audits) internalRouter.register("audits", audits);

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
        await this.publicServer.close();
    }

}

export { HostingServer }
