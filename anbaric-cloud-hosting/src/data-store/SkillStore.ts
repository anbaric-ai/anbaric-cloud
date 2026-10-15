/* A skill is guidance a tenant writes for the agents that build on it: when to
   reach for it (the usage hints, which an agent reads before deciding) and
   what to do (the body, which it reads once it has decided). Kept by the
   platform, managed from the console, and never handed to deployed apps. */
type Skill = {
    id : string,
    title : string,
    usageHints : string,
    body : string,
    /* A managed skill: written by the platform's operators rather than the
       tenant, shown as such, and not the tenant's to change or remove. */
    locked : boolean,
    createdAt : Date,
    updatedAt : Date,
};

type SkillDraft = Omit<Skill, "createdAt" | "updatedAt">;

/* The id ends up as the tail of a tool name an agent sees, after a fixed
   prefix, and tool names are capped at 64 characters: hence the shape and
   the length. */
const SKILL_ID_SHAPE = /^[a-z0-9][a-z0-9-]{0,49}$/;

const isSkillId = (value : unknown) : value is string =>
    typeof value === "string" && SKILL_ID_SHAPE.test(value);

interface SkillStore {

    list() : Promise<Array<Skill>>;

    get(id : string) : Promise<Skill | undefined>;

    // Creates or replaces the skill with that id.
    save(draft : SkillDraft) : Promise<Skill>;

    remove(id : string) : Promise<boolean>;

}

export type { Skill, SkillDraft, SkillStore };
export { SKILL_ID_SHAPE, isSkillId };
