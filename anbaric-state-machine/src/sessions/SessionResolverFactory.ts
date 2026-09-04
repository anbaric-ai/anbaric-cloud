import {SessionResolver} from "anbaric-tsapi";
import {CloudSessionResolver} from "anbaric-impl-cloud";
import {InMemorySessionResolver} from "./InMemorySessionResolver.js";

const SessionResolverFactory = {
    instance() : SessionResolver {
        switch (process.env.ANBARIC_SESSION_RESOLVER_TYPE) {
            case "cloud":
                return new CloudSessionResolver();
            default:
                return new InMemorySessionResolver();
        }
    }
}

export { SessionResolverFactory };
