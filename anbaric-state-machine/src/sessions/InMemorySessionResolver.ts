import {ResolvedSession, SessionResolver} from "anbaric-tsapi";

/* A resolver backed by a seeded token->session map, for local runs and tests.
   Empty by default, so an unknown token resolves to undefined. */
class InMemorySessionResolver implements SessionResolver {

    private sessions = new Map<string, ResolvedSession>();

    seed(sessionToken : string, session : ResolvedSession) : this {
        this.sessions.set(sessionToken, session);
        return this;
    }

    async resolve(sessionToken : string) : Promise<ResolvedSession | undefined> {
        return this.sessions.get(sessionToken);
    }

}

export { InMemorySessionResolver }
