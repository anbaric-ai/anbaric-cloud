import {describe, expect, it} from "vitest";
import {IncomingMessage, ServerResponse} from "node:http";
import {InMemoryAppSettingsStore} from "../../src/data-store/InMemoryAppSettingsStore";
import {PublicApps} from "../../src/hosting/PublicApps";
import {Request} from "../../src/hosting/Request";

const requestFor = (url : string, headers : Record<string, string> = {}) =>
    new Request({ url, method: "GET", headers } as unknown as IncomingMessage, {} as ServerResponse);

describe("PublicApps", () => {

    it("knows a public app by its path or by its hostname", async () => {
        const settings = new InMemoryAppSettingsStore();
        await settings.set("shop", { public: true });
        const publicApps = new PublicApps(settings);

        expect(await publicApps.includes(requestFor("/app/shop/basket"))).toBe(true);
        expect(await publicApps.includes(requestFor("/basket", { "x-anbaric-app-host": "shop" }))).toBe(true);
        expect(await publicApps.includes(requestFor("/app/crm/"))).toBe(false);
    });

    it("never counts the platform's own paths on an app's hostname, or its API, as the app's", async () => {
        const settings = new InMemoryAppSettingsStore();
        await settings.set("shop", { public: true });
        const publicApps = new PublicApps(settings);

        expect(await publicApps.includes(requestFor("/logout", { "x-anbaric-app-host": "shop" }))).toBe(false);
        expect(await publicApps.includes(requestFor("/api/v2/app/shop"))).toBe(false);
    });

    it("remembers an answer for a few seconds, then asks again", async () => {
        const settings = new InMemoryAppSettingsStore();
        let now = 0;
        const publicApps = new PublicApps(settings, () => now);

        expect(await publicApps.includes(requestFor("/app/shop/"))).toBe(false);
        await settings.set("shop", { public: true });
        expect(await publicApps.includes(requestFor("/app/shop/"))).toBe(false);

        now = 5_001;
        expect(await publicApps.includes(requestFor("/app/shop/"))).toBe(true);
    });

});
