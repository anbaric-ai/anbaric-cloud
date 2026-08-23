import {LoadedPlugin} from "../../plugins/Plugin";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class PluginsHandler implements RequestHandler {

    constructor(private plugins : Array<LoadedPlugin>) {
    }

    async handle(request : Request) : Promise<void> {
        if (request.method !== "GET") return request.notFound();
        if (!request.id) return this.manifest(request);
        if (request.id === "data") return this.data(request);
        if (request.id.endsWith(".js")) return this.bundle(request);
        request.notFound();
    }

    private manifest(request : Request) : void {
        request.reply(200, this.plugins.map(({ name, plugin }) => ({
            name,
            bundle: `/api/v2/plugins/${name}.js`,
            pages: plugin.pages,
            widgets: plugin.widgets.map(({ page, id, title, position, data }) =>
                ({ page, id, title, position, hasData: data !== undefined })),
        })));
    }

    private bundle(request : Request) : void {
        const name = request.id!.slice(0, -".js".length);
        const found = this.plugins.find(plugin => plugin.name === name);
        if (!found) return request.notFound();
        request.replyJavaScript(found.bundle);
    }

    private async data(request : Request) : Promise<void> {
        const pluginName = request.query("plugin");
        const widgetId = request.query("widget");
        const found = this.plugins.find(plugin => plugin.name === pluginName);
        const widget = found?.plugin.widgets.find(candidate => candidate.id === widgetId);
        if (!widget?.data) {
            return request.reply(404, { error: `No data function found for widget "${widgetId}" of plugin "${pluginName}"` });
        }
        const parameters : Record<string, string> = {};
        for (const [key, value] of request.url.searchParams) {
            if (key !== "plugin" && key !== "widget") parameters[key] = value;
        }
        request.reply(200, (await widget.data(parameters)) ?? null);
    }

}

export { PluginsHandler }
