import {Request} from "./Request";
import {RequestHandler} from "./RequestHandler";

/* Deliberately hollow: other systems register API handlers (served only under
   /api/v2), site handlers (top-level pages/proxies), one root handler, and one
   fallback. All business logic lives in the handlers. */
class Router {

    private apiHandlers = new Map<string, RequestHandler>();
    private siteHandlers = new Map<string, RequestHandler>();
    private rootHandler? : RequestHandler;
    private fallbackHandler? : RequestHandler;

    registerApi(resource : string, handler : RequestHandler) : void {
        this.apiHandlers.set(resource, handler);
    }

    register(resource : string, handler : RequestHandler) : void {
        this.siteHandlers.set(resource, handler);
    }

    registerRoot(handler : RequestHandler) : void {
        this.rootHandler = handler;
    }

    registerFallback(handler : RequestHandler) : void {
        this.fallbackHandler = handler;
    }

    async route(request : Request) : Promise<void> {
        if (request.api) {
            const handler = request.resource === undefined ? undefined : this.apiHandlers.get(request.resource);
            return handler ? handler.handle(request) : request.notFound();
        }

        if (request.resource === undefined) {
            if (this.rootHandler) return this.rootHandler.handle(request);
            return request.notFound();
        }

        const handler = this.siteHandlers.get(request.resource);
        if (handler) return handler.handle(request);
        if (this.fallbackHandler) return this.fallbackHandler.handle(request);

        request.notFound();
    }

}

export { Router }
