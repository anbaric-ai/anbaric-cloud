import {createRequire} from "node:module";
import {build, Plugin as EsbuildPlugin} from "esbuild";

/* Compiles a plugin module twice: a browser ESM bundle whose react,
   react-dom and design-system imports are aliased to the dashboard's
   window.AnbaricPluginRuntime global, and a node bundle whose UI imports
   are replaced with inert stubs so the module can be imported server-side
   (for page metadata and widget data functions) without a DOM or CSS
   loader. */
class PluginBundler {

    private resolve = createRequire(import.meta.url).resolve;

    async bundleForBrowser(moduleName : string) : Promise<string> {
        return this.bundle(moduleName, {
            platform: "browser",
            plugins: [this.replacementPlugin(browserReplacement)],
        });
    }

    async bundleForServer(moduleName : string) : Promise<string> {
        return this.bundle(moduleName, {
            platform: "node",
            packages: "external",
            plugins: [this.replacementPlugin(serverReplacement)],
        });
    }

    private async bundle(moduleName : string, options : object) : Promise<string> {
        const result = await build({
            entryPoints: [this.resolve(moduleName)],
            bundle: true,
            format: "esm",
            jsx: "automatic",
            write: false,
            logLevel: "silent",
            ...options,
        });
        return result.outputFiles[0].text;
    }

    private replacementPlugin(replacement : (path : string) => string) : EsbuildPlugin {
        return {
            name: "anbaric-plugin-runtime",
            setup(pluginBuild) {
                pluginBuild.onResolve({ filter: /^react(-dom)?(\/|$)|^@anbaric\/design-system(\/|$)/ }, resolving =>
                    ({ path: resolving.path, namespace: "anbaric-runtime" }));
                pluginBuild.onResolve({ filter: /\.css$/ }, resolving =>
                    ({ path: resolving.path, namespace: "anbaric-runtime" }));
                pluginBuild.onLoad({ filter: /.*/, namespace: "anbaric-runtime" }, loading =>
                    ({ contents: replacement(loading.path), loader: "js" }));
            },
        };
    }

}

const browserReplacement = (path : string) : string => {
    if (path.endsWith(".css")) return "";
    if (path === "react/jsx-runtime" || path === "react/jsx-dev-runtime") {
        return "module.exports = window.AnbaricPluginRuntime.jsxRuntime;";
    }
    if (path === "react" || path.startsWith("react/")) {
        return "module.exports = window.AnbaricPluginRuntime.React;";
    }
    if (path === "react-dom" || path.startsWith("react-dom/")) {
        return "module.exports = window.AnbaricPluginRuntime.ReactDOM;";
    }
    return "module.exports = window.AnbaricPluginRuntime.DesignSystem;";
};

const serverReplacement = (path : string) : string =>
    path.endsWith(".css") ? "" : "module.exports = {};";

export { PluginBundler }
