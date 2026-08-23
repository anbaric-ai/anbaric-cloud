import {ResolvedSession, SessionResolver} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient";

/* Resolves a platform session token by asking the platform to verify it (an app
   holds no signing secret). A rejected request - an invalid or expired token
   answers 401 - resolves to undefined. */
class CloudSessionResolver implements SessionResolver {

    constructor(private client : CloudApiClient = new CloudApiClient(CloudApiClient.defaultBaseUrl())) {}

    async resolve(sessionToken : string) : Promise<ResolvedSession | undefined> {
        try {
            const result = await this.client.request("POST", "/sessions/resolve", { session: sessionToken });
            return { id: result.id, roles: result.roles ?? [], tenant: result.tenant };
        } catch {
            return undefined;
        }
    }

}

export { CloudSessionResolver }
