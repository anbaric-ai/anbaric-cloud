import {Middleware} from "../Middleware";
import {Request} from "../Request";

/* Many tenants share one load balancer, which picks between them on the
   x-anbaric-tenant header. If a request arrives here naming a different tenant,
   something upstream is wrong - a listener rule with the wrong condition, a
   duplicated priority, a slug reused before its old rule was removed. Nothing
   is lost when that happens, because a session signed by another tenant fails
   verification here anyway, but it fails silently and looks like being logged
   out. Answering 421 turns it into a named, countable error instead.

   A request that names no tenant passes: the header is optional, and an
   unmanaged platform has no tenant of its own to compare against. */
class TenantRoutingMiddleware implements Middleware {

    constructor(private tenant : string | undefined) {}

    async apply(request : Request) : Promise<boolean> {
        const claimed = String(request.header("x-anbaric-tenant") ?? "").trim();
        if (! this.tenant || ! claimed || claimed === this.tenant) return true;

        console.error(`[routing] a request for tenant "${claimed}" reached the platform for "${this.tenant}"`);
        request.reply(421, { error: `This platform does not serve tenant "${claimed}"` });
        return false;
    }

}

export { TenantRoutingMiddleware }
