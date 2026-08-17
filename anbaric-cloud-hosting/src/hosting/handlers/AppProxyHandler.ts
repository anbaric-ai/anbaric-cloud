import {BuildLayer} from "../../app-management/BuildLayer";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

/* The router's fallback: any unregistered top-level path naming a running
   app is forwarded to it. */
class AppProxyHandler implements RequestHandler {

    constructor(private buildLayer : BuildLayer) {}

    async handle(request : Request) : Promise<void> {
        const appName = request.resource!;
        const app = this.buildLayer.status(appName);
        if (!app || app.status !== "running") return request.notFound();

        const appPath = request.url.pathname.slice(`/${appName}`.length) || "/";
        const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.rawBody();

        const upstream = await fetch(`http://${app.appHost}:${app.appPort}${appPath}${request.url.search}`, {
            method: request.method,
            headers: { "content-type": request.header("content-type") ?? "application/json" },
            body: body && body.length > 0 ? new Uint8Array(body) : undefined,
        });

        const payload = Buffer.from(await upstream.arrayBuffer());
        request.rawResponse.writeHead(upstream.status, {
            "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
        });
        request.rawResponse.end(payload);
    }

}

export { AppProxyHandler }
