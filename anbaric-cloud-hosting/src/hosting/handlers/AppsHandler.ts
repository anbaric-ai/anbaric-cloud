import {BuildLayer} from "../../app-management/BuildLayer";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class AppsHandler implements RequestHandler {

    constructor(private buildLayer : BuildLayer) {}

    async handle(request : Request) : Promise<void> {
        await this.buildLayer.ensureHydrated();
        switch (request.subresource) {
            case "deploy":
                if (request.id) return this.handleDeploy(request, request.id);
                break;
            case "logs":
                if (request.id) return this.handleLogs(request, request.id);
                break;
            case undefined:
                if (request.id) return this.handleApp(request, request.id);
                return this.handleCollection(request);
        }
        request.notFound();
    }

    private async handleDeploy(request : Request, appName : string) : Promise<void> {
        switch (request.method) {
            case "POST": {
                const appPort = Number(request.query("port"));
                if (!Number.isInteger(appPort) || appPort <= 0) {
                    return request.reply(400, { error: "Expected a numeric ?port query parameter - the app's internal port (\"internalPort\" in .anbaric/app-config.json)" });
                }
                const tarball = await request.rawBody();
                if (tarball.length === 0) return request.reply(400, { error: "Expected a gzipped tarball body" });
                return request.reply(202, this.buildLayer.deploy(appName, appPort, tarball));
            }
        }
        request.notFound();
    }

    private async handleApp(request : Request, appName : string) : Promise<void> {
        switch (request.method) {
            case "GET": {
                const status = this.buildLayer.status(appName);
                if (!status) return request.reply(404, { error: `No app named "${appName}"` });
                const live = await this.buildLayer.ping(appName);
                return request.reply(200, { ...status, live });
            }
            case "DELETE": {
                const torn = await this.buildLayer.teardown(appName);
                if (!torn) return request.reply(404, { error: `No app named "${appName}"` });
                return request.reply(200, { appName, status: "stopped" });
            }
        }
        request.notFound();
    }

    private async handleLogs(request : Request, appName : string) : Promise<void> {
        if (request.method !== "GET") return request.notFound();
        if (!this.buildLayer.status(appName)) return request.reply(404, { error: `No app named "${appName}"` });

        const response = request.rawResponse;
        response.writeHead(200, {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-cache",
            "x-content-type-options": "nosniff",
        });

        const controller = new AbortController();
        request.raw.on("close", () => controller.abort());

        // A newline heartbeat after each idle interval keeps the streamed
        // connection alive through the edge (CloudFront/ALB) read timeouts when
        // the app is producing no output.
        const beat = () : ReturnType<typeof setTimeout> => setTimeout(() => {
            if (!response.writableEnded) { response.write("\n"); heartbeat = beat(); }
        }, 15_000);
        let heartbeat = beat();

        try {
            for await (const line of this.buildLayer.logs(appName, controller.signal)) {
                clearTimeout(heartbeat);
                if (!response.write(`${line}\n`)) {
                    await new Promise<void>(resolve => response.once("drain", resolve));
                }
                heartbeat = beat();
            }
        } catch (error) {
            if (!controller.signal.aborted) {
                response.write(`[log stream error: ${error instanceof Error ? error.message : error}]\n`);
            }
        } finally {
            clearTimeout(heartbeat);
            response.end();
        }
    }

    private async handleCollection(request : Request) : Promise<void> {
        switch (request.method) {
            case "GET":
                return request.reply(200, this.buildLayer.list());
        }
        request.notFound();
    }

}

export { AppsHandler }
