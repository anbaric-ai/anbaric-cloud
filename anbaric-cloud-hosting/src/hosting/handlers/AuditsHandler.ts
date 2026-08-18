import {AuditInteraction} from "anbaric-tsapi";
import {AuditRecordStore} from "../../auditing/AuditRecordStore";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

const AUDIT_INTERACTIONS = new Set(["CREATE", "UPDATE_PROPERTIES", "CHANGE_STATE", "DELETE", "READ", "LIST"]);

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
        if (typeof record?.resourceType !== "string" || typeof record?.resourceId !== "string"
            || typeof record?.description !== "string" || typeof record?.actorId !== "string"
            || typeof record?.actorType !== "string"
            || !Array.isArray(record?.interaction) || record.interaction.length === 0
            || !record.interaction.every((interaction : unknown) => typeof interaction === "string" && AUDIT_INTERACTIONS.has(interaction))) {
            return request.reply(400, { error: "Expected a body of { resourceType, resourceId, actorId, actorType, interaction: [...], description, ... }" });
        }
        await this.auditRecords.save(record);
        request.reply(204);
    }

    private async handleQuery(request : Request) : Promise<void> {
        const interaction = request.query("interaction");
        const records = await this.auditRecords.list({
            resourceType: request.query("resourceType"),
            resourceId: request.query("resourceId"),
            actorId: request.query("actorId"),
            interaction: interaction && AUDIT_INTERACTIONS.has(interaction) ? interaction as AuditInteraction : undefined,
            search: request.query("search"),
            pageSize: request.query("pageSize") === undefined ? undefined : Number(request.query("pageSize")),
            page: request.query("page") === undefined ? undefined : Number(request.query("page")),
        });
        request.reply(200, records);
    }

}

export { AuditsHandler }
