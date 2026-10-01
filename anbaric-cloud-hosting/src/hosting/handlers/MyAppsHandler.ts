import {BuildLayer} from "../../app-management/BuildLayer";
import {appAddress} from "../../app-management/appAddress";
import {EntitlementStore} from "../../data-store/EntitlementStore";
import {Subdomains} from "../../subdomains/Subdomains";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

/* The entitlement that says a person may open an app at all. The platform
   seeds it as a global definition, so it exists in every tenant from the first
   migration and nobody has to create it. Granted globally it means every app;
   granted against one app it means that app. */
const ACCESS = "access";

/* The apps this person may open, which is what the directory shows someone who
   is not a builder. The same question Entitlements.has answers one app at a
   time, asked once for the whole list. */
class MyAppsHandler implements RequestHandler {

    constructor(private buildLayer : BuildLayer, private entitlements : EntitlementStore,
                private subdomains? : Subdomains) {}

    async handle(request : Request) : Promise<void> {
        if (request.method !== "GET" || request.id) return request.notFound();
        if (! request.user) return request.reply(401, { error: "You are not signed in" });

        await this.buildLayer.ensureHydrated();

        const grants = (await this.entitlements.listGrants(request.user.id))
            .filter(grant => grant.entitlementId === ACCESS);
        const everyApp = grants.some(grant => grant.appId === null);
        const named = new Set(grants.map(grant => grant.appId));

        const addresses = new Map(
            (this.subdomains ? await this.subdomains.all() : []).map(held => [held.appName, held.subdomain]));

        request.reply(200, this.buildLayer.list()
            .filter(app => everyApp || named.has(app.appName))
            .map(app => ({
                appName: app.appName,
                status: app.status,
                subdomain: addresses.get(app.appName),
                url: appAddress(app.appName, addresses.get(app.appName)),
            })));
    }

}

export { MyAppsHandler, ACCESS };
