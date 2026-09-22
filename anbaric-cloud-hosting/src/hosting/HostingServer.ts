import {JobPersistence, JobRunSchedulePersistence, JsonStore, Notifier, PromptManager, SecretStore} from "anbaric-tsapi";
import {BuildLayer} from "../app-management/BuildLayer";
import {AuditRecordStore} from "../auditing/AuditRecordStore";
import {Authenticator} from "../auth/Authenticator";
import {CliAuthorizer} from "../auth/CliAuthorizer";
import {TokenAuthenticator} from "../auth/TokenAuthenticator";
import {RemoteQueue} from "../queuing/RemoteQueue";
import {ConsumerRegistry} from "../queuing/ConsumerRegistry";
import {AppProxyHandler} from "./handlers/AppProxyHandler";
import {AppLinkFallbackHandler} from "./handlers/AppLinkFallbackHandler";
import {AppsHandler} from "./handlers/AppsHandler";
import {AuditsHandler} from "./handlers/AuditsHandler";
import {AuthorizeCliHandler} from "./handlers/auth/AuthorizeCliHandler";
import {KeysHandler} from "./handlers/auth/KeysHandler";
import {SessionsHandler} from "./handlers/auth/SessionsHandler";
import {UsersHandler} from "./handlers/auth/UsersHandler";
import {InvitationsHandler} from "./handlers/auth/InvitationsHandler";
import {PromptsHandler} from "./handlers/PromptsHandler";
import {MembershipService} from "../auth/MembershipService";
import {WhoamiHandler} from "./handlers/auth/WhoamiHandler";
import {UserDirectory} from "../auth/UserDirectory";
import {ConsumersHandler} from "./handlers/ConsumersHandler";
import {DocumentsHandler} from "./handlers/DocumentsHandler";
import {EntitlementsAdminHandler} from "./handlers/EntitlementsAdminHandler";
import {EntitlementsHandler} from "./handlers/EntitlementsHandler";
import {EntitlementStore} from "../data-store/EntitlementStore";
import {JobsHandler} from "./handlers/JobsHandler";
import {FaviconHandler} from "./handlers/FaviconHandler";
import {JobRunSchedulesHandler} from "./handlers/JobRunSchedulesHandler";
import {NotificationsHandler} from "./handlers/NotificationsHandler";
import {LogoutHandler} from "./handlers/LogoutHandler";
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

    constructor(persistence : JobPersistence, queue : RemoteQueue,
                registry : ConsumerRegistry = new ConsumerRegistry(),
                buildLayer? : BuildLayer,
                documentStoreFor? : (appId : string, collection : string) => JsonStore,
                secretStoreFor? : (appId : string) => SecretStore,
                authenticator? : Authenticator,
                cliAuthorizer? : CliAuthorizer,
                tokenAuthenticator? : TokenAuthenticator,
                tenant? : string,
                auditRecords? : AuditRecordStore,
                plugins : Array<LoadedPlugin> = [],
                jobRunSchedules? : JobRunSchedulePersistence,
                notifier? : Notifier,
                entitlements? : EntitlementStore,
                userDirectory? : UserDirectory,
                memberships? : MembershipService,
                promptManagerFor? : (appId : string) => PromptManager) {
        const pages = new PagesHandler();
        const ping = new PingHandler(tenant);
        const jobs = new JobsHandler(persistence);
        const queueHandler = new QueueHandler(queue);
        const consumers = new ConsumersHandler(registry);
        const stateMachines = new StateMachinesHandler(registry);
        const documents = documentStoreFor && new DocumentsHandler(documentStoreFor);
        const secrets = secretStoreFor && new SecretsHandler(secretStoreFor);
        const audits = auditRecords && new AuditsHandler(auditRecords);
        const sessions = new SessionsHandler();

        const publicRouter = new Router();
        publicRouter.registerRoot(pages);
        publicRouter.register("ping", ping);
        publicRouter.register("favicon.ico", new FaviconHandler());
        publicRouter.register("logout", new LogoutHandler(authenticator));
        if (plugins.length > 0) publicRouter.registerApi("plugins", new PluginsHandler(plugins));
        publicRouter.registerApi("whoami", new WhoamiHandler(tenant));
        publicRouter.registerApi("sessions", sessions);
        publicRouter.registerApi("jobs", jobs);
        publicRouter.registerApi("queue", queueHandler);
        publicRouter.registerApi("consumers", consumers);
        publicRouter.registerApi("state-machines", stateMachines);
        if (documents) publicRouter.registerApi("documents", documents);
        if (secrets) publicRouter.registerApi("secrets", secrets);
        if (audits) publicRouter.registerApi("audits", audits);
        if (jobRunSchedules) publicRouter.registerApi("job-run-schedules", new JobRunSchedulesHandler(jobRunSchedules));
        if (notifier) publicRouter.registerApi("notifications", new NotificationsHandler(notifier));
        if (entitlements) publicRouter.registerApi("entitlements", new EntitlementsAdminHandler(entitlements));
        if (userDirectory) publicRouter.registerApi("users", new UsersHandler(userDirectory));
        if (memberships) publicRouter.registerApi("invitations", new InvitationsHandler(memberships));
        const prompts = promptManagerFor && new PromptsHandler(promptManagerFor);
        if (prompts) publicRouter.registerApi("prompts", prompts);
        if (cliAuthorizer) {
            publicRouter.register("authorize-cli", new AuthorizeCliHandler(cliAuthorizer, pages, tenant));
            publicRouter.registerApi("keys", new KeysHandler(cliAuthorizer));
        }
        if (buildLayer) {
            publicRouter.registerApi("apps", new AppsHandler(buildLayer));
            publicRouter.register("app", new AppProxyHandler(buildLayer));
        }
        // An unrouted absolute path carrying an app Referer is an app-internal
        // link the proxy's prefix-stripping left bare; send it back to its app.
        publicRouter.registerFallback(new AppLinkFallbackHandler());

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
        if (jobRunSchedules) internalRouter.registerApi("job-run-schedules", new JobRunSchedulesHandler(jobRunSchedules));
        if (notifier) internalRouter.registerApi("notifications", new NotificationsHandler(notifier));
        if (entitlements) internalRouter.registerApi("entitlements", new EntitlementsHandler(entitlements));
        if (prompts) internalRouter.registerApi("prompts", prompts);

        // The favicon is requested by the browser before anyone has signed in,
        // and by deployed apps' pages, so gating it behind a session would send
        // an icon request to the login flow and leave every page iconless.
        const openRequests = (request : Request) =>
            request.url.pathname === "/ping" ||
            request.url.pathname === "/favicon.ico" ||
            (request.method === "GET" && CLI_KEY_POLL.test(request.url.pathname));

        this.publicServer = new Server(publicRouter, [
            new SessionMiddleware(),
            new AuthenticationMiddleware(authenticator, tokenAuthenticator, openRequests, undefined, userDirectory),
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
