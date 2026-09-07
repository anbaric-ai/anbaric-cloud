import {JobRunSchedulePersistence} from "anbaric-tsapi";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class JobRunSchedulesHandler implements RequestHandler {

    constructor(private persistence : JobRunSchedulePersistence) {}

    async handle(request : Request) : Promise<void> {
        if (request.subresource) return request.notFound();

        if (request.method === "GET" && request.id === "high-water-mark") {
            const appId = request.url.searchParams.get("appId") ?? "";
            const workflowId = request.url.searchParams.get("workflowId");
            if (!workflowId) return request.reply(400, { error: "A workflowId is required" });

            const latest = await this.persistence.highWaterMark(appId, workflowId);
            return request.reply(200, { highWaterMark: latest?.toISOString() ?? null });
        }

        if (request.method !== "POST" || !request.id) return request.notFound();

        switch (request.id) {
            case "plan": {
                const { runs } = await request.body();
                await this.persistence.plan((runs ?? []).map((run : any) => ({
                    appId: run.appId ?? "",
                    workflowId: run.workflowId,
                    runAt: new Date(run.runAt),
                })));
                return request.reply(204);
            }
            case "claim-due": {
                const { at } = await request.body();
                const claimed = await this.persistence.claimDue(at ? new Date(at) : new Date());
                return request.reply(200, {
                    runs: claimed.map(run => ({ ...run, runAt: run.runAt.toISOString() })),
                });
            }
        }
        request.notFound();
    }

}

export { JobRunSchedulesHandler }
