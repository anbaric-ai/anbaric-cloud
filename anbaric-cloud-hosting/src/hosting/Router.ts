import {Request} from "./Request";
import {RequestHandler} from "./RequestHandler";

/* Deliberately hollow: other systems register a handler per top-level
   resource, one for the root, and one fallback for anything unregistered
   (the app proxy). All business logic lives in the handlers. */
class Router {

    private handlers = new Map<string, RequestHandler>();
    private rootHandler? : RequestHandler;
    private fallbackHandler? : RequestHandler;

    register(resource : string, handler : RequestHandler) : void {
        this.handlers.set(resource, handler);
    }

    registerRoot(handler : RequestHandler) : void {
        this.rootHandler = handler;
    }

    registerFallback(handler : RequestHandler) : void {
        this.fallbackHandler = handler;
    }

    async route(request : Request) : Promise<void> {
        if (request.resource === undefined) {
            if (this.rootHandler) return this.rootHandler.handle(request);
            return request.notFound();
        }

        const handler = this.handlers.get(request.resource);
        if (handler) return handler.handle(request);
        if (this.fallbackHandler) return this.fallbackHandler.handle(request);

        request.notFound();
    }

}

export { Router }
