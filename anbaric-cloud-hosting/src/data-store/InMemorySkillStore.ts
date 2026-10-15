import {Skill, SkillDraft, SkillStore} from "./SkillStore";

class InMemorySkillStore implements SkillStore {

    private skills = new Map<string, Skill>();

    async list() : Promise<Array<Skill>> {
        return [...this.skills.values()]
            .sort((left, right) => left.id.localeCompare(right.id))
            .map(skill => ({ ...skill }));
    }

    async get(id : string) : Promise<Skill | undefined> {
        const skill = this.skills.get(id);
        return skill && { ...skill };
    }

    async save(draft : SkillDraft) : Promise<Skill> {
        const now = new Date();
        const saved : Skill = { ...draft, createdAt: this.skills.get(draft.id)?.createdAt ?? now, updatedAt: now };
        this.skills.set(draft.id, saved);
        return { ...saved };
    }

    async remove(id : string) : Promise<boolean> {
        return this.skills.delete(id);
    }

}

export { InMemorySkillStore };
