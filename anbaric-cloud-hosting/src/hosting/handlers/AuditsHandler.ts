import {AuditChange} from "anbaric-tsapi";
import {AuditRecordStore} from "../../auditing/AuditRecordStore";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

const AUDIT_CHANGES = new Set(["CREATE", "UPDATE_PROPERTIES", "CHANGE_STATE", "DELETE"]);

class AuditsHandler implements RequestHandler {

    constructor(private auditRecords : AuditRecordStore) {}

    async handle(request : Request) : Promise<void> {
        if (request.id) return request.notFound();

        switch (request.method) {
            case "POST":
                return this.handleRecord(request);
            case "GET":
                return this.handleQuery(request);
        }
        request.notFound();
    }

    private async handleRecord(request : Request) : Promise<void> {
        const record = await request.body();
        if (typeof record?.jobId !== "string" || typeof record?.description !== "string"
            || typeof record?.actorId !== "string" || typeof record?.actorType !== "string"
            || !AUDIT_CHANGES.has(record?.change)) {
            return request.reply(400, { error: "Expected a body of { jobId, actorId, actorType, change, description, ... }" });
        }
        await this.auditRecords.save(record);
        request.reply(204);
    }

    private async handleQuery(request : Request) : Promise<void> {
        const change = request.query("change");
        const records = await this.auditRecords.list({
            jobId: request.query("jobId"),
            actorId: request.query("actorId"),
            change: change && AUDIT_CHANGES.has(change) ? change as AuditChange : undefined,
            search: request.query("search"),
            pageSize: request.query("pageSize") === undefined ? undefined : Number(request.query("pageSize")),
            page: request.query("page") === undefined ? undefined : Number(request.query("page")),
        });
        request.reply(200, records);
    }

}

export { AuditsHandler }
