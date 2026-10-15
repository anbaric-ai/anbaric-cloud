import {deniesBuild} from "../../auth/TenantRole";
import {isSkillId, Skill, SkillStore} from "../../data-store/SkillStore";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

/* The tenant's skills: guidance its builders write for the agents that work
   on it. Anyone in the tenant may read them - an agent acting for a user
   needs them as much as one acting for a builder - but writing them is a
   builder's job. Served to people and their agents only, never to deployed
   apps, which is why this is registered on the public entry point alone. */
class SkillsHandler implements RequestHandler {

    constructor(private skills : SkillStore) {}

    async handle(request : Request) : Promise<void> {
        if (request.subresource) return request.notFound();
        if (request.id) return this.handleSkill(request, request.id);
        return this.handleCollection(request);
    }

    private async handleCollection(request : Request) : Promise<void> {
        if (request.method !== "GET") return request.notFound();
        return request.reply(200, (await this.skills.list()).map(skill => this.publicSkill(skill)));
    }

    private async handleSkill(request : Request, id : string) : Promise<void> {
        switch (request.method) {
            case "GET": {
                const skill = await this.skills.get(id);
                if (! skill) return request.reply(404, { error: `No skill with id "${id}"` });
                return request.reply(200, this.publicSkill(skill));
            }
            case "PUT": {
                if (deniesBuild(request.user?.tenantRole)) return this.refuse(request);
                if (! isSkillId(id)) {
                    return request.reply(400, { error: `"${id}" is not a skill id: lower-case letters, digits and hyphens, up to 50 characters` });
                }
                const body = await request.body();
                const draft = this.draftFrom(body);
                if (! draft) return request.reply(400, { error: "Expected a body of { title : string, usageHints : string, body : string }, none empty" });

                return request.reply(200, this.publicSkill(await this.skills.save({ id, ...draft })));
            }
            case "DELETE": {
                if (deniesBuild(request.user?.tenantRole)) return this.refuse(request);
                const removed = await this.skills.remove(id);
                return removed ? request.reply(204) : request.reply(404, { error: `No skill with id "${id}"` });
            }
        }
        request.notFound();
    }

    private refuse(request : Request) : void {
        request.reply(403, { error: "Your role in this tenant cannot manage skills" });
    }

    private draftFrom(body : unknown) : { title : string, usageHints : string, body : string } | undefined {
        const fields = body as Record<string, unknown> | undefined;
        const text = (value : unknown) : string | undefined =>
            typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

        const title = text(fields?.title);
        const usageHints = text(fields?.usageHints);
        const content = text(fields?.body);
        return title && usageHints && content ? { title, usageHints, body: content } : undefined;
    }

    private publicSkill(skill : Skill) {
        return {
            id: skill.id,
            title: skill.title,
            usageHints: skill.usageHints,
            body: skill.body,
            createdAt: skill.createdAt.toISOString(),
            updatedAt: skill.updatedAt.toISOString(),
        };
    }

}

export { SkillsHandler };
