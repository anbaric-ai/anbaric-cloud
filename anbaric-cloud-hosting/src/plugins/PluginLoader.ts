import {createHash} from "node:crypto";
import {mkdir, writeFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {LoadedPlugin, Plugin} from "./Plugin";
import {PluginBundler} from "./PluginBundler";

/* Loads the comma-separated ANBARIC_PLUGINS module list: each module is
   compiled for the server and imported to obtain its plugin export (pages,
   widgets, data functions), and compiled for the browser into the bundle
   the dashboard fetches from /plugins/<name>.js. The server compilation is
   written inside node_modules so any imports the plugin left external still
   resolve when the module is evaluated. */
class PluginLoader {

    constructor(private bundler : PluginBundler = new PluginBundler(),
                private cacheDirectory : string = `${process.cwd()}/node_modules/.anbaric-plugins`) {
    }

    async load(specification? : string) : Promise<Array<LoadedPlugin>> {
        if (!specification) return [];
        const moduleNames = specification.split(",").map(name => name.trim()).filter(Boolean);
        const loaded = await Promise.all(moduleNames.map(moduleName => this.loadOne(moduleName)));
        for (const plugin of loaded) {
            if (loaded.some(other => other !== plugin && other.name === plugin.name)) {
                throw new Error(`Two plugin modules register the plugin name "${plugin.name}"`);
            }
        }
        return loaded;
    }

    private async loadOne(moduleName : string) : Promise<LoadedPlugin> {
        const plugin = await this.importForServer(moduleName);
        const bundle = await this.bundler.bundleForBrowser(moduleName);
        return { name: plugin.name, plugin, bundle };
    }

    private async importForServer(moduleName : string) : Promise<Plugin> {
        const code = await this.bundler.bundleForServer(moduleName);
        const fileName = `${moduleName.replace(/[^a-z0-9-]+/gi, "-")}-${createHash("sha256").update(code).digest("hex").slice(0, 12)}.mjs`;
        await mkdir(this.cacheDirectory, { recursive: true });
        const modulePath = `${this.cacheDirectory}/${fileName}`;
        await writeFile(modulePath, code);
        const module = await import(pathToFileURL(modulePath).href);
        return this.validated(moduleName, module.plugin);
    }

    private validated(moduleName : string, plugin : any) : Plugin {
        if (!plugin || typeof plugin.name !== "string") {
            throw new Error(`Plugin module "${moduleName}" does not export a plugin with a name`);
        }
        if (!Array.isArray(plugin.pages) || !Array.isArray(plugin.widgets)) {
            throw new Error(`Plugin "${plugin.name}" must declare pages and widgets arrays`);
        }
        for (const page of plugin.pages) {
            if (typeof page.path !== "string" || !page.path.startsWith("/") || typeof page.title !== "string") {
                throw new Error(`Plugin "${plugin.name}" declares a page without a valid path and title`);
            }
        }
        for (const widget of plugin.widgets) {
            if (typeof widget.page !== "string" || typeof widget.id !== "string" || typeof widget.component !== "function") {
                throw new Error(`Plugin "${plugin.name}" declares a widget without a page, id and component`);
            }
            if (widget.data !== undefined && typeof widget.data !== "function") {
                throw new Error(`Plugin "${plugin.name}" widget "${widget.id}" has a data field that is not a function`);
            }
        }
        return plugin;
    }

}

export { PluginLoader }
