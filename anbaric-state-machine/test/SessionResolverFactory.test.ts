import {afterEach, describe, expect, it} from "vitest";
import {CloudSessionResolver} from "anbaric-impl-cloud";
import {InMemorySessionResolver} from "../src/sessions/InMemorySessionResolver.js";
import {SessionResolverFactory} from "../src/sessions/SessionResolverFactory.js";

describe("SessionResolverFactory", () => {

    afterEach(() => { delete process.env.ANBARIC_SESSION_RESOLVER_TYPE; });

    it("returns a cloud resolver when ANBARIC_SESSION_RESOLVER_TYPE is cloud", () => {
        process.env.ANBARIC_SESSION_RESOLVER_TYPE = "cloud";
        expect(SessionResolverFactory.instance()).toBeInstanceOf(CloudSessionResolver);
    });

    it("returns an in-memory resolver by default", () => {
        expect(SessionResolverFactory.instance()).toBeInstanceOf(InMemorySessionResolver);
    });

});
