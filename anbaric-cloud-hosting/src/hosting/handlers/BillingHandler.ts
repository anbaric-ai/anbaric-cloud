import {CentralBilling} from "../../billing/CentralBilling";
import {canInvite, deniesBuild} from "../../auth/TenantRole";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

/* The console's costs page. A builder may see what the tenant is spending;
   only an owner or admin may go and change how it pays. */
class BillingHandler implements RequestHandler {

    constructor(private billing : CentralBilling, private publicUrl : string = process.env.ANBARIC_PLATFORM_PUBLIC_URL ?? "") {}

    async handle(request : Request) : Promise<void> {
        if (request.method === "GET" && request.id === "summary") return this.summary(request);
        if (request.method === "POST" && request.id === "portal") return this.portal(request);
        if (request.method === "DELETE" && request.id === "account") return this.terminate(request);
        request.notFound();
    }

    /* The end of the tenant, which only its owner may ask for, and only by
       typing the word: the page asks for it, and this refuses without it, so
       nothing in a script or a stray click can do it by accident. */
    private async terminate(request : Request) : Promise<void> {
        if (request.user?.tenantRole !== "OWNER") {
            return request.reply(403, { error: "Only the owner of this tenant can terminate it" });
        }

        const body = await request.body() as { confirm? : string } | undefined;
        if (body?.confirm !== "DELETE") return request.reply(400, { error: 'Terminating a tenant needs { confirm : "DELETE" }' });

        try {
            await this.billing.terminate(request.user.id);
            request.reply(202, { terminated: true });
        } catch (error) {
            request.reply(409, { error: error instanceof Error ? error.message : "Could not terminate this tenant" });
        }
    }

    private async summary(request : Request) : Promise<void> {
        if (deniesBuild(request.user?.tenantRole)) {
            return request.reply(403, { error: "Your role in this tenant cannot see its costs" });
        }
        try {
            request.reply(200, await this.billing.summary());
        } catch (error) {
            request.reply(502, { error: error instanceof Error ? error.message : "Could not read this tenant's costs" });
        }
    }

    private async portal(request : Request) : Promise<void> {
        if (! canInvite(request.user?.tenantRole)) {
            return request.reply(403, { error: "Your role in this tenant cannot change its payment details" });
        }

        const body = await request.body() as { returnTo? : string } | undefined;
        const returnTo = typeof body?.returnTo === "string" && body.returnTo.startsWith("/") ? body.returnTo : "/";

        try {
            request.reply(200, { url: await this.billing.portalUrl(`${this.publicUrl.replace(/\/$/, "")}${returnTo}`) });
        } catch (error) {
            request.reply(409, { error: error instanceof Error ? error.message : "Could not open the payment details page" });
        }
    }

}

export { BillingHandler };
