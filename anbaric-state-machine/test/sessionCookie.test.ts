import {describe, expect, it} from "vitest";
import {sessionCookie} from "../src/sessions/sessionCookie.js";

describe("sessionCookie", () => {

    it("extracts the anbaric_session value from a request", () => {
        const request = { headers: { cookie: "x=1; anbaric_session=abc.def; y=2" } } as any;

        expect(sessionCookie(request)).toBe("abc.def");
    });

    it("extracts from a raw Cookie header string", () => {
        expect(sessionCookie("anbaric_session=tok")).toBe("tok");
    });

    it("returns undefined when the cookie is absent", () => {
        expect(sessionCookie("x=1; y=2")).toBeUndefined();
        expect(sessionCookie({ headers: {} } as any)).toBeUndefined();
    });

});
