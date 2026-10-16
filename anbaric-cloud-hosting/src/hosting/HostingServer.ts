import {FileStorage, JobPersistence, JobRunSchedulePersistence, JsonStore, Notifier, PromptManager, SecretStore, SystemActor} from "anbaric-tsapi";
import {BuildLayer} from "../app-management/BuildLayer";
import {AuditRecordStore} from "../auditing/AuditRecordStore";
import {Authenticator} from "../auth/Authenticator";
import {CliAuthorizer} from "../auth/CliAuthorizer";
import {TokenAuthenticator} from "../auth/TokenAuthenticator";
import {RemoteQueue} from "../queuing/RemoteQueue";
import {ConsumerRegistry} from "../queuing/ConsumerRegistry";
import {ConsumerRoute, RejectedMessage} from "../queuing/Dispatcher";
import {InMemoryStateMachineStore} from "../data-store/InMemoryStateMachineStore";
import {StateMachineStore} from "../data-store/StateMachineStore";
import {AppProxyHandler} from "./handlers/AppProxyHandler";
import {AppLinkFallbackHandler} from "./handlers/AppLinkFallbackHandler";
import {AppsHandler} from "./handlers/AppsHandler";
import {MyAppsHandler} from "./handlers/MyAppsHandler";
import {MembersHandler} from "./handlers/auth/MembersHandler";
import {BillingHandler} from "./handlers/BillingHandler";
import {CentralBilling} from "../billing/CentralBilling";
import {AppSettingsStore} from "../data-store/AppSettingsStore";
import {SkillStore} from "../data-store/SkillStore";
import {SkillsHandler} from "./handlers/SkillsHandler";
import {Subdomains} from "../subdomains/Subdomains";
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
import {FilesHandler} from "./handlers/FilesHandler";
import {StateMachinesHandler} from "./handlers/StateMachinesHandler";
import {PluginsHandler} from "./handlers/PluginsHandler";
import {AuthenticationMiddleware} from "./middleware/AuthenticationMiddleware";
import {SessionMiddleware} from "./middleware/SessionMiddleware";
import {TenantRoutingMiddleware} from "./middleware/TenantRoutingMiddleware";
import {AppHostMiddleware} from "./middleware/AppHostMiddleware";
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
    /* Where the dispatcher sends a message: to the app's deployment when
       there is one, since the build layer decided where the app listens,
       and otherwise wherever its machine registered itself. */
    readonly consumerRoute : ConsumerRoute;
    /* A message the app turned away is taken off the queue and its job
       cancelled, since the app has no machine that will ever run it. */
    readonly rejectedMessage : RejectedMessage;

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
                promptManagerFor? : (appId : string) => PromptManager,
                fileStorageFor? : (appId : string) => FileStorage,
                subdomains? : Subdomains,
                billing? : CentralBilling,
                appSettings? : AppSettingsStore,
                skills? : SkillStore,
                operatorKey? : string,
                stateMachineStore : StateMachineStore = new InMemoryStateMachineStore()) {
        this.consumerRoute = async (appId, workflowId) => {
            if (appId && buildLayer) {
                await buildLayer.ensureHydrated();
                const deployed = buildLayer.consumerUrlFor(appId);
                if (deployed) return deployed;
            }
            return registry.lookup(appId, workflowId);
        };
        this.rejectedMessage = async message => {
            await queue.cancel(message);
            const where = message.appId ? `app "${message.appId}"` : "its app";
            await persistence.cancel(message.jobId, SystemActor.actor, `${where} has no state machine "${message.workflowId}"`);
        };

        const pages = new PagesHandler();
        const ping = new PingHandler(tenant);
        const jobs = new JobsHandler(persistence);
        const queueHandler = new QueueHandler(queue);
        const consumers = new ConsumersHandler(registry, stateMachineStore);
        const stateMachines = new StateMachinesHandler(stateMachineStore);
        const documents = documentStoreFor && new DocumentsHandler(documentStoreFor);
        const secrets = secretStoreFor && new SecretsHandler(secretStoreFor);
        const files = fileStorageFor && new FilesHandler(fileStorageFor);
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
        if (files) publicRouter.registerApi("files", files);
        if (audits) publicRouter.registerApi("audits", audits);
        if (jobRunSchedules) publicRouter.registerApi("job-run-schedules", new JobRunSchedulesHandler(jobRunSchedules));
        if (notifier) publicRouter.registerApi("notifications", new NotificationsHandler(notifier));
        if (entitlements) publicRouter.registerApi("entitlements", new EntitlementsAdminHandler(entitlements));
        if (userDirectory) publicRouter.registerApi("users", new UsersHandler(userDirectory));
        if (memberships) publicRouter.registerApi("invitations", new InvitationsHandler(memberships, entitlements));
        if (memberships) publicRouter.registerApi("members", new MembersHandler(memberships, entitlements));
        if (billing) publicRouter.registerApi("billing", new BillingHandler(billing));
        // People and their agents only: a deployed app has no business reading skills.
        if (skills) publicRouter.registerApi("skills", new SkillsHandler(skills));
        const prompts = promptManagerFor && new PromptsHandler(promptManagerFor);
        if (prompts) publicRouter.registerApi("prompts", prompts);
        if (cliAuthorizer) {
            publicRouter.register("authorize-cli", new AuthorizeCliHandler(cliAuthorizer, pages, tenant));
            publicRouter.registerApi("keys", new KeysHandler(cliAuthorizer));
        }
        const appProxy = buildLayer ? new AppProxyHandler(buildLayer) : undefined;
        if (buildLayer && appProxy) {
            // So a deploy can ask the running version to drain: an app with a
            // registered machine is asked at its deployment's address, which
            // the store remembers across a platform restart.
            buildLayer.consumerUrlsFor = async appName => {
                const urls = new Set(registry.list().filter(consumer => consumer.appId === appName).map(consumer => consumer.url));
                const deployed = buildLayer.consumerUrlFor(appName);
                if (deployed && (await stateMachineStore.list()).some(machine => machine.appId === appName)) urls.add(deployed);
                return [...urls];
            };
            buildLayer.appRemoved = appName => void subdomains?.release(appName);
            publicRouter.registerApi("apps", new AppsHandler(buildLayer, tenant, subdomains, appSettings));
            publicRouter.register("app", appProxy);

            // The directory a person who is not a builder sees instead of the
            // console, so it only exists where entitlements decide access.
            if (entitlements) {
                publicRouter.registerApi("my-apps", new MyAppsHandler(buildLayer, entitlements, subdomains));
            }
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
        if (files) internalRouter.registerApi("files", files);
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

        const authentication =
            new AuthenticationMiddleware(authenticator, tokenAuthenticator, openRequests, undefined, userDirectory, memberships, operatorKey);

        /* Entitlements an inviter chose before this person had a user id were
           put aside under their email address; their first sign-in is when
           they can finally be granted. */
        if (entitlements) {
            authentication.claimWhatIsOwed = async user => {
                if (user.email) await entitlements.claim(user.email, user.id);
                // Someone who came in through a link is owed what the link carries.
                const token = await memberships?.joinedVia(user.id);
                if (token) await entitlements.claimLink(token, user.id);
            };
        }

        this.publicServer = new Server(publicRouter, [
            new SessionMiddleware(),
            new TenantRoutingMiddleware(tenant),
            authentication,
            /* After authentication and before routing: an app reached by its own
               hostname owns every path on it, so nothing of the platform's would
               match anyway - but a nicer address must not also be a way in
               without a session. */
            new AppHostMiddleware(appProxy),
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
