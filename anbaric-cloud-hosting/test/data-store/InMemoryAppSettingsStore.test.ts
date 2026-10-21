import {describe, expect, it} from "vitest";
import {InMemoryAppSettingsStore} from "../../src/data-store/InMemoryAppSettingsStore";

describe("InMemoryAppSettingsStore", () => {

    it("gives an unconfigured app the defaults", async () => {
        expect(await new InMemoryAppSettingsStore().get("crm")).toEqual({ appName: "crm", zeroDowntime: false, public: false });
    });

    it("keeps what is set, and lists only apps that were configured", async () => {
        const store = new InMemoryAppSettingsStore();

        expect(await store.set("crm", { zeroDowntime: true })).toEqual({ appName: "crm", zeroDowntime: true, public: false });
        await store.get("other");

        expect((await store.get("crm")).zeroDowntime).toBe(true);
        expect(await store.list()).toEqual([{ appName: "crm", zeroDowntime: true, public: false }]);
    });

    it("forgets an app that is removed", async () => {
        const store = new InMemoryAppSettingsStore();
        await store.set("crm", { zeroDowntime: true });

        await store.remove("crm");

        expect((await store.get("crm")).zeroDowntime).toBe(false);
        expect(await store.list()).toEqual([]);
    });

});
