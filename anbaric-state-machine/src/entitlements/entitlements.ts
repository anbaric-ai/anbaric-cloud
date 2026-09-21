import {IncomingMessage} from "node:http";
import {currentAppId, Entitlements, SessionResolver} from "anbaric-tsapi";
import {sessionCookie} from "../sessions/sessionCookie.js";
import {SessionResolverFactory} from "../sessions/SessionResolverFactory.js";
import {EntitlementsFactory} from "./EntitlementsFactory.js";

let shared : Entitlements | undefined;

const sharedEntitlements = () : Entitlements => shared ??= EntitlementsFactory.instance();

/* Declares an entitlement this app checks - a startup activity. The
   definition is scoped to the current app; global entitlements are created
   in the console, never by an app. */
const registerEntitlement = async (entitlementId : string, notes : string = "",
                                   entitlements : Entitlements = sharedEntitlements()) : Promise<void> => {
    await entitlements.register(currentAppId(), entitlementId, notes);
};

/* Whether the user behind a session holds the entitlement for the current
   app. Takes the incoming request (its anbaric_session cookie) or a raw
   session token, exactly as Human.fromSession does. An unresolvable session
   is simply not entitled. */
const hasEntitlement = async (source : string | IncomingMessage, entitlementId : string,
                              resolver : SessionResolver = SessionResolverFactory.instance(),
                              entitlements : Entitlements = sharedEntitlements()) : Promise<boolean> => {
    const token = typeof source === "string" ? source : sessionCookie(source);
    const session = token ? await resolver.resolve(token) : undefined;
    if (! session) return false;
    return entitlements.has(currentAppId(), session.id, entitlementId);
};

export { registerEntitlement, hasEntitlement }
