import {BuildLayer} from "../../app-management/BuildLayer";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class AppsHandler implements RequestHandler {

    constructor(private buildLayer : BuildLayer) {}

    async handle(request : Request) : Promise<void> {
        switch (request.subresource) {
            case "deploy":
                if (request.id) return this.handleDeploy(request, request.id);
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
                    return request.reply(400, { error: "Expected a numeric port query parameter" });
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
        }
        request.notFound();
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
