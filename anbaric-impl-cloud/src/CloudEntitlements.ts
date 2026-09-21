import {AppAware, currentAppId, Entitlements} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient.js";

/* The app id travels as the ambient app header the client always sends, so
   the platform scopes registrations to the calling app and an app can never
   register or check on behalf of another. */
class CloudEntitlements implements Entitlements, AppAware {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl()) {
        this.client = new CloudApiClient(baseUrl);
    }

    getAppId() : string {
        return currentAppId();
    }

    async register(_appId : string, entitlementId : string, notes : string = "") : Promise<void> {
        await this.client.request("POST", "/entitlements", { entitlementId, notes });
    }

    async has(_appId : string, userId : string, entitlementId : string) : Promise<boolean> {
        const path = `/entitlements/${encodeURIComponent(entitlementId)}/check?userId=${encodeURIComponent(userId)}`;
        const result = await this.client.request("GET", path) as { has : boolean };
        return result.has;
    }

}

export { CloudEntitlements }
