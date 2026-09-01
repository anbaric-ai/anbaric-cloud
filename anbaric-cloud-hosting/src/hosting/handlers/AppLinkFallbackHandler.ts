import {appInternalRedirect} from "anbaric-web";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

/* The public router's fallback for an otherwise-unrouted path. When the request
   is an app-internal absolute link (identified by its Referer), it is redirected
   back onto its app; anything else is a genuine 404. A 307 is used so a form
   POST to an absolute action keeps its method and body across the redirect.

   The redirect must never be cached: the same root path (e.g. "/thing") maps to
   different apps depending on the Referer, so a stored mapping would send one
   app's request to another. `no-store` forbids caching outright and
   `Vary: Referer` states the dependency for any cache that stores it anyway. */
class AppLinkFallbackHandler implements RequestHandler {

    async handle(request : Request) : Promise<void> {
        const target = appInternalRedirect(request.url.pathname, request.url.search, request.header("referer"));
        if (target !== undefined) {
            return request.redirect(target, 307, { "cache-control": "no-store", "vary": "Referer" });
        }
        request.notFound();
    }

}

export { AppLinkFallbackHandler };
