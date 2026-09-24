import {IncomingHttpHeaders, OutgoingHttpHeaders, request as httpRequest} from "node:http";
import {BuildLayer} from "../../app-management/BuildLayer";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";
import {DEPLOYING, FAILED, NOT_RUNNING} from "../pages/ErrorPage";

/* Headers that describe a single hop and must not be forwarded across the
   proxy in either direction. */
const HOP_BY_HOP = new Set([
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade",
]);

/* Serves /app/<name>: the named running app is reverse-proxied to. The
   /app/<name> prefix is stripped before forwarding (the app sees the sub-path)
   and surfaced as X-Forwarded-Prefix so the app can rebuild public URLs.
   Request and response headers pass through both ways - notably cookies,
   Set-Cookie and Location - so sessions and redirects work from app-served
   HTML. */
class AppProxyHandler implements RequestHandler {

    constructor(private buildLayer : BuildLayer) {}

    async handle(request : Request) : Promise<void> {
        const appName = request.id;
        if (! appName) return request.notFound();

        // Under /app/<name> the app is mounted on a sub-path, so it is told
        // where it really lives and the prefix is taken off what it receives.
        await this.serve(request, appName, request.url.pathname.slice(`/app/${appName}`.length) || "/", `/app/${appName}`);
    }

    /* The same app, reached by its own hostname. Nothing is stripped and there
       is no prefix to announce, because the app is at the root of that host -
       exactly where it was when it was built and run locally. */
    async serveAtRoot(request : Request, appName : string) : Promise<void> {
        await this.serve(request, appName, request.url.pathname, "");
    }

    private async serve(request : Request, appName : string, appPath : string, prefix : string) : Promise<void> {
        await this.buildLayer.ensureHydrated();
        const app = this.buildLayer.status(appName);
        if (! app) return request.notFound();

        /* An app is torn down while its replacement builds, so a visitor who
           arrives mid-deploy would otherwise be told the app does not exist.
           It does; it is just between versions, and saying so - with a page
           that comes back on its own - is the difference between a blip and an
           outage as far as anyone watching is concerned. */
        if (app.status !== "running") {
            return request.replyProblem(
                app.status === "building" ? DEPLOYING : app.status === "failed" ? FAILED : NOT_RUNNING);
        }

        const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.rawBody();

        await new Promise<void>((resolve, reject) => {
            const upstream = httpRequest({
                host: app.appHost,
                port: app.appPort,
                method: request.method,
                path: `${appPath}${request.url.search}`,
                headers: this.forwardHeaders(request, prefix),
            }, response => {
                request.rawResponse.writeHead(response.statusCode ?? 502, this.passThrough(response.headers));
                response.pipe(request.rawResponse);
                response.on("end", resolve);
                response.on("error", reject);
            });
            upstream.on("error", reject);
            if (body && body.length > 0) upstream.write(body);
            upstream.end();
        });
    }

    private forwardHeaders(request : Request, prefix : string) : OutgoingHttpHeaders {
        const headers = this.passThrough(request.raw.headers);
        delete headers.host;
        headers["x-forwarded-prefix"] = prefix;
        headers["x-forwarded-host"] = request.raw.headers.host;
        headers["x-forwarded-proto"] = "https";
        return headers;
    }

    private passThrough(headers : IncomingHttpHeaders) : OutgoingHttpHeaders {
        const kept : OutgoingHttpHeaders = {};
        for (const [name, value] of Object.entries(headers)) {
            if (value === undefined || HOP_BY_HOP.has(name)) continue;
            kept[name] = value;
        }
        return kept;
    }

}

export { AppProxyHandler }
