import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import {PluginLoader} from "../../src/plugins/PluginLoader";

const fixture = (name : string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

describe("PluginLoader", () => {

    it("returns no plugins when nothing is configured", async () => {
        expect(await new PluginLoader().load(undefined)).toEqual([]);
        expect(await new PluginLoader().load("")).toEqual([]);
    });

    it("loads a plugin module and exposes its pages and widgets server-side", async () => {
        const [loaded] = await new PluginLoader().load(fixture("test-plugin"));

        expect(loaded.name).toBe("test-plugin");
        expect(loaded.plugin.pages).toEqual([{ path: "/testing", title: "Testing", icon: "info", navOrder: 5 }]);
        expect(loaded.plugin.widgets[0].id).toBe("counter");
        expect(typeof loaded.plugin.widgets[0].component).toBe("function");
    });

    it("runs widget data functions server-side", async () => {
        const [loaded] = await new PluginLoader().load(fixture("test-plugin"));

        expect(await loaded.plugin.widgets[0].data!({ colour: "red" })).toEqual({ echoed: { colour: "red" } });
    });

    it("compiles a browser bundle against the dashboard runtime instead of bundling react", async () => {
        const [loaded] = await new PluginLoader().load(fixture("test-plugin"));

        expect(loaded.bundle).toContain("window.AnbaricPluginRuntime");
        expect(loaded.bundle).not.toContain("node_modules/react");
        expect(loaded.bundle).not.toContain("rebeccapurple");
    });

    it("keeps pg and node builtins available to data functions server-side", async () => {
        const [loaded] = await new PluginLoader().load(fixture("pg-plugin"));

        expect(await loaded.plugin.widgets[0].data!({})).toEqual({ pool: "function", hash: "function" });
    });

    it("stubs pg and node builtins out of the browser bundle instead of bundling them", async () => {
        const [loaded] = await new PluginLoader().load(fixture("pg-plugin"));

        expect(loaded.bundle).toContain("window.AnbaricPluginRuntime");
        expect(loaded.bundle).not.toContain("node_modules/pg");
        expect(loaded.bundle).not.toContain("pg-pool");
    });

    it("loads the state-machines plugin that ships with the platform", async () => {
        const [loaded] = await new PluginLoader().load("anbaric-plugins/state-machines");

        expect(loaded.name).toBe("state-machines");
        expect(loaded.plugin.pages[0]).toEqual({ path: "/", title: "Dashboard", icon: "dashboard", navOrder: 0 });
        expect(loaded.bundle).toContain("window.AnbaricPluginRuntime");
    });

    it("rejects a module that does not export a plugin", async () => {
        await expect(new PluginLoader().load(fixture("no-plugin")))
            .rejects.toThrowError(/does not export a plugin with a name/);
    });

    it("rejects two modules registering the same plugin name", async () => {
        await expect(new PluginLoader().load(`${fixture("test-plugin")},${fixture("test-plugin")}`))
            .rejects.toThrowError('Two plugin modules register the plugin name "test-plugin"');
    });

});
