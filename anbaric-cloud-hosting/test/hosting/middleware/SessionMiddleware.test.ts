import {describe, expect, it} from "vitest";
import {SessionMiddleware} from "../../../src/hosting/middleware/SessionMiddleware";
import {Request} from "../../../src/hosting/Request";

const requestWithCookie = (cookie? : string) =>
    ({ header: (name : string) => name === "cookie" ? cookie : undefined }) as unknown as Request;

describe("SessionMiddleware", () => {

    it("lifts the platform session and the central identity off the cookie header", async () => {
        const request = requestWithCookie("anbaric_session=s1; anbaric_central_session=i1; other=x");

        await new SessionMiddleware().apply(request);

        expect(request.session).toBe("s1");
        expect(request.identity).toBe("i1");
    });

    it("leaves both undefined when neither cookie is present", async () => {
        const request = requestWithCookie(undefined);

        await new SessionMiddleware().apply(request);

        expect(request.session).toBeUndefined();
        expect(request.identity).toBeUndefined();
    });

    // A browser sends a host-only cookie before a domain one of the same
    // name; the first is what the server sees, as it always has.
    it("takes the first of a name when a browser sends two", async () => {
        const request = requestWithCookie("anbaric_session=first; anbaric_session=second");

        await new SessionMiddleware().apply(request);

        expect(request.session).toBe("first");
    });

    it("keeps an = inside a value", async () => {
        const request = requestWithCookie("anbaric_central_session=a.b=c==");

        await new SessionMiddleware().apply(request);

        expect(request.identity).toBe("a.b=c==");
    });

});
