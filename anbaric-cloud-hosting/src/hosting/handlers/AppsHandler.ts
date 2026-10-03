import {BuildLayer, isAppSize} from "../../app-management/BuildLayer";
import {deniesBuild} from "../../auth/TenantRole";
import {Request} from "../Request";
import {hostnameObjection} from "../../app-management/appHostname";
import {appAddress} from "../../app-management/appAddress";
import {redactEmails} from "../../app-management/redactEmails";
import {RequestHandler} from "../RequestHandler";
import {Subdomains} from "../../subdomains/Subdomains";

class AppsHandler implements RequestHandler {

    constructor(private buildLayer : BuildLayer, private tenant? : string,
                private subdomains? : Subdomains) {}

    async handle(request : Request) : Promise<void> {
        // Changing what is deployed is a builder's job; a USER may look.
        if (this.changesApps(request) && deniesBuild(request.user?.tenantRole)) {
            return request.reply(403, { error: "Your role in this tenant cannot deploy or remove apps" });
        }

        await this.buildLayer.ensureHydrated();
        switch (request.subresource) {
            case "deploy":
                if (request.id) return this.handleDeploy(request, request.id);
                break;
            case "logs":
                if (request.id) return this.handleLogs(request, request.id);
                break;
            case "docs":
                if (request.id) return this.handleDocs(request, request.id);
                break;
            case "subdomain":
                if (request.id) return this.handleSubdomain(request, request.id);
                break;
            case "size":
                if (request.id) return this.handleSize(request, request.id);
                break;
            case undefined:
                if (request.id) return this.handleApp(request, request.id);
                return this.handleCollection(request);
        }
        request.notFound();
    }

    private changesApps(request : Request) : boolean {
        if (request.subresource === "deploy" || request.subresource === "docs") return true;
        if (request.subresource === "subdomain" || request.subresource === "size") return request.method === "PUT";
        return request.subresource === undefined && request.method === "DELETE";
    }

    /* How big the app's instance is, which is a builder's to change and costs
       what the console told them it would. The app is rolled onto the new
       size; what it is doing is drained first, as any deploy does. */
    private async handleSize(request : Request, appName : string) : Promise<void> {
        if (request.method !== "PUT") return request.notFound();

        const body = await request.body() as { size? : string } | undefined;
        if (! isAppSize(body?.size)) return request.reply(400, { error: 'Expected a body of { size : "small" | "large" }' });

        const summary = await this.buildLayer.resize(appName, body.size);
        if (! summary) return request.reply(404, { error: `No app named "${appName}"` });
        return request.reply(200, summary);
    }

    /* Where an app answers, which is a builder's to change. The address itself
       is the control plane's to agree, so a name already taken comes back from
       there as a refusal and is passed on as one. */
    private async handleSubdomain(request : Request, appName : string) : Promise<void> {
        if (request.method !== "PUT") return request.notFound();
        if (! this.subdomains) {
            return request.reply(409, { error: "This platform does not give its apps addresses of their own" });
        }
        if (! this.buildLayer.status(appName)) return request.reply(404, { error: `No app named "${appName}"` });

        const body = await request.body() as { subdomain? : string } | undefined;
        const wanted = String(body?.subdomain ?? "").trim().toLowerCase();

        try {
            return request.reply(200, await this.subdomains.set(appName, wanted));
        } catch (error) {
            return request.reply(409, { error: error instanceof Error ? error.message : "That address is not available" });
        }
    }

    private async handleDocs(request : Request, appName : string) : Promise<void> {
        if (request.method !== "POST") return request.notFound();
        try {
            const docs = await this.buildLayer.regenerateDocs(appName);
            return request.reply(200, { appName, docs });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Could not regenerate documentation";
            return request.reply(message.startsWith("No app") ? 404 : 400, { error: message });
        }
    }

    private async handleDeploy(request : Request, appName : string) : Promise<void> {
        switch (request.method) {
            case "POST": {
                /* Refused here rather than at the edge: a name that cannot be
                   part of a hostname would deploy happily and then simply not
                   be reachable by its own address, which is a worse thing to
                   discover later. */
                const objection = hostnameObjection(appName);
                if (objection) return request.reply(400, { error: objection });

                const appPort = Number(request.query("port"));
                if (!Number.isInteger(appPort) || appPort <= 0) {
                    return request.reply(400, { error: "Expected a numeric ?port query parameter - the app's internal port (\"internalPort\" in .anbaric/app-config.json)" });
                }
                const tarball = await request.rawBody();
                if (tarball.length === 0) return request.reply(400, { error: "Expected a gzipped tarball body" });

                const summary = this.buildLayer.deploy(appName, appPort, tarball);

                /* An address is asked for alongside the build rather than
                   after it: allocation is idempotent, so a redeploy costs
                   nothing, and a first deploy has its address ready by the
                   time the app is up. */
                const address = await this.subdomains?.allocate(appName);
                return request.reply(202, {
                    ...summary,
                    subdomain: address?.subdomain,
                    url: appAddress(appName, address?.subdomain),
                });
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
                const subdomain = await this.addressOf(appName);
                return request.reply(200, { ...status, live, subdomain, url: appAddress(appName, subdomain) });
            }
            case "DELETE": {
                const outcome = await this.buildLayer.teardown(appName);
                if (!outcome) return request.reply(404, { error: `No app named "${appName}"` });

                // The address is let go by the build layer's appRemoved hook,
                // which an app that drains reaches minutes after this returns.
                return request.reply(200, outcome);
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
                if (!response.write(`${redactEmails(line)}\n`)) {
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
            case "GET": {
                const addresses = new Map((await this.addresses()).map(held => [held.appName, held.subdomain]));
                return request.reply(200, this.buildLayer.list().map(app => {
                    const subdomain = addresses.get(app.appName);
                    return { ...app, subdomain, url: appAddress(app.appName, subdomain) };
                }));
            }
        }
        request.notFound();
    }

    private async addressOf(appName : string) : Promise<string | undefined> {
        return (await this.addresses()).find(held => held.appName === appName)?.subdomain;
    }

    /* An address is the control plane's to know, so a platform without one -
       self-hosted, or local - simply has none, and the console falls back to
       serving its apps by path. */
    private async addresses() {
        return this.subdomains ? this.subdomains.all() : [];
    }

}

export { AppsHandler }
