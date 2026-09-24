import {describe, expect, it} from "vitest";
import {DEPLOYING, FAILED, NOT_FOUND, NOT_RUNNING, render} from "../../src/hosting/pages/ErrorPage";

describe("ErrorPage", () => {

    it("shows the logo, named for screen readers, and says what happened", () => {
        const page = render(NOT_FOUND);

        expect(page).toMatch(/<img class="logo" src="data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+" alt="Anbaric">/);
        expect(page).toContain("Nothing here");
        expect(page).toContain("<!doctype html>");
    });

    it("comes back on its own only while something is still happening", () => {
        expect(render(DEPLOYING)).toContain('http-equiv="refresh"');
        expect(render(FAILED)).not.toContain('http-equiv="refresh"');
        expect(render(NOT_RUNNING)).not.toContain('http-equiv="refresh"');
    });

    it("tells a visitor mid-deploy to wait rather than that the app is gone", () => {
        expect(DEPLOYING.status).toBe(503);
        expect(NOT_FOUND.status).toBe(404);
        expect(render(DEPLOYING)).toContain("being deployed");
    });

    it("escapes what it is given, so a heading cannot inject markup", () => {
        const page = render({ status: 404, heading: "<script>alert(1)</script>", detail: "A & B" });

        expect(page).not.toContain("<script>alert");
        expect(page).toContain("&lt;script&gt;");
        expect(page).toContain("A &amp; B");
    });

    it("carries no external asset, so it renders when nothing else is up", () => {
        const page = render(DEPLOYING);

        expect(page).not.toContain("http://");
        expect(page).not.toContain("https://");
        expect(page).not.toMatch(/<(script|link)\b/);
        expect(page).not.toMatch(/<img\b[^>]*src="(?!data:)/);
    });

});
