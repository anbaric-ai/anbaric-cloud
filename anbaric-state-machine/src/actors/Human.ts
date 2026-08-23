import {IncomingMessage} from "node:http";
import {Actor, SessionResolver} from "anbaric-tsapi";
import {SessionResolverFactory} from "../sessions/SessionResolverFactory";
import {sessionCookie} from "../sessions/sessionCookie";

class Human implements Actor {

    readonly type = "HUMAN" as const;
    readonly id : string;
    readonly roles : Array<string>;

    constructor(id : string, roles : Array<string> | string) {
        this.id = id;
        this.roles = typeof roles === "string" ? [roles] : roles;
    }

    /* Resolves the browser user behind a request to an app page into a Human,
       for auditing. Takes the platform session - either the anbaric_session
       token, or the incoming request to read the cookie from - and asks the
       platform to verify it (an app cannot: the signing secret is platform
       only). */
    static async fromSession(source : string | IncomingMessage,
                             resolver : SessionResolver = SessionResolverFactory.instance()) : Promise<Human> {
        const token = typeof source === "string" ? source : sessionCookie(source);
        const session = token ? await resolver.resolve(token) : undefined;
        if (!session) throw new Error("Could not resolve the session");
        return new Human(session.id, session.roles);
    }

}

export { Human }
