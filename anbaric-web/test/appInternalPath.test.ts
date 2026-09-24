import {describe, expect, it} from "vitest";
import {appInternalPath, appInternalRedirect, appInternalUrl} from "../src/appInternalPath";

const fromApp = (name : string, page = "/") => `https://platform.example/app/${name}${page}`;

describe("appInternalPath", () => {

    it("places an absolute path onto the named app", () => {
        expect(appInternalPath("crm", "/orders")).toBe("/app/crm/orders");
        expect(appInternalPath("crm", "/orders", "?page=2")).toBe("/app/crm/orders?page=2");
    });

    it("leaves a path already under a known prefix untouched", () => {
        expect(appInternalPath("crm", "/api/v2/jobs")).toBeUndefined();
        expect(appInternalPath("crm", "/app/crm/orders")).toBeUndefined();   // already prefixed
        expect(appInternalPath("crm", "/api")).toBeUndefined();
        expect(appInternalPath("crm", "/app")).toBeUndefined();
    });

    it("does rewrite a path that merely starts with those letters", () => {
        expect(appInternalPath("crm", "/apple")).toBe("/app/crm/apple");
        expect(appInternalPath("crm", "/apiary")).toBe("/app/crm/apiary");
    });

    it("leaves a fully-qualified url untouched", () => {
        expect(appInternalPath("crm", "https://elsewhere.example/x")).toBeUndefined();
        expect(appInternalPath("crm", "//elsewhere.example/x")).toBeUndefined();
    });

    // App authors are told to prefer relative links, so this is the shape the
    // guidance actually produces. Refusing it sent the link to the console root.
    it("treats a relative path as app-relative rather than refusing it", () => {
        expect(appInternalPath("crm", "orders")).toBe("/app/crm/orders");
        expect(appInternalPath("crm", "approve", "?job=1")).toBe("/app/crm/approve?job=1");
    });

    it("does nothing without an app name", () => {
        expect(appInternalPath(undefined, "/orders")).toBeUndefined();
        expect(appInternalPath("", "/orders")).toBeUndefined();
    });

});

describe("appInternalRedirect", () => {

    it("redirects an absolute resource back onto the app named by the Referer", () => {
        expect(appInternalRedirect("/styles.css", "", fromApp("crm"))).toBe("/app/crm/styles.css");
    });

    it("redirects a nested resource path", () => {
        expect(appInternalRedirect("/css/app.css", "", fromApp("crm", "/orders"))).toBe("/app/crm/css/app.css");
    });

    it("preserves the query string", () => {
        expect(appInternalRedirect("/orders", "?page=2", fromApp("crm", "/dashboard"))).toBe("/app/crm/orders?page=2");
    });

    it("reads the app from a Referer that carries its own query", () => {
        expect(appInternalRedirect("/x", "", "https://platform.example/app/crm/orders?p=1")).toBe("/app/crm/x");
    });

    it("reads the app from a Referer with no trailing slash", () => {
        expect(appInternalRedirect("/x", "", "https://platform.example/app/crm")).toBe("/app/crm/x");
    });

    it("accepts a bare-path Referer", () => {
        expect(appInternalRedirect("/x", "", "/app/crm/page")).toBe("/app/crm/x");
    });

    it("does not rewrite a path already under /app", () => {
        expect(appInternalRedirect("/app/crm/x", "", fromApp("crm"))).toBeUndefined();
    });

    it("does not rewrite a path under /api", () => {
        expect(appInternalRedirect("/api/v2/jobs", "", fromApp("crm"))).toBeUndefined();
    });

    it("treats /api and /app themselves as known prefixes", () => {
        expect(appInternalRedirect("/api", "", fromApp("crm"))).toBeUndefined();
        expect(appInternalRedirect("/app", "", fromApp("crm"))).toBeUndefined();
    });

    it("does rewrite a path that merely starts with those letters", () => {
        expect(appInternalRedirect("/apple", "", fromApp("crm"))).toBe("/app/crm/apple");
        expect(appInternalRedirect("/apiary", "", fromApp("crm"))).toBe("/app/crm/apiary");
    });

    it("does nothing without a Referer", () => {
        expect(appInternalRedirect("/styles.css", "", undefined)).toBeUndefined();
    });

    it("does nothing for a Referer that is not an app page", () => {
        expect(appInternalRedirect("/x", "", "https://platform.example/")).toBeUndefined();
        expect(appInternalRedirect("/x", "", "https://platform.example/dashboard")).toBeUndefined();
    });

    it("does nothing for a bare /app Referer with no app name", () => {
        expect(appInternalRedirect("/x", "", "https://platform.example/app/")).toBeUndefined();
    });

});

describe("appInternalUrl", () => {

    it("prefixes an app-relative resolve URL onto its app, preserving the query", () => {
        expect(appInternalUrl("crm", "/approve?job=1")).toBe("/app/crm/approve?job=1");
        expect(appInternalUrl("ci-bulletin", "/review/42")).toBe("/app/ci-bulletin/review/42");
    });

    it("leaves an already-prefixed or external URL unchanged", () => {
        expect(appInternalUrl("crm", "/app/crm/approve")).toBe("/app/crm/approve");
        expect(appInternalUrl("crm", "https://elsewhere.example/x")).toBe("https://elsewhere.example/x");
    });

    it("places a relative URL on its app, query and all", () => {
        expect(appInternalUrl("crm", "approve?job=1")).toBe("/app/crm/approve?job=1");
    });

    it("leaves the URL unchanged when there is no app", () => {
        expect(appInternalUrl(undefined, "/approve")).toBe("/approve");
        expect(appInternalUrl("", "/approve")).toBe("/approve");
    });

});
