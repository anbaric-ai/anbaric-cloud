import {Pool} from "pg";
import {Skill, SkillDraft, SkillStore} from "./SkillStore";

const COLUMNS = "id, title, usage_hints, body, created_at, updated_at";

const rowToSkill = (row : any) : Skill => ({
    id: row.id,
    title: row.title,
    usageHints: row.usage_hints,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

class PostgresSkillStore implements SkillStore {

    constructor(private pool : Pool) {}

    async list() : Promise<Array<Skill>> {
        const result = await this.pool.query(`SELECT ${COLUMNS} FROM anbaric_system.skills ORDER BY id`);
        return result.rows.map(rowToSkill);
    }

    async get(id : string) : Promise<Skill | undefined> {
        const result = await this.pool.query(`SELECT ${COLUMNS} FROM anbaric_system.skills WHERE id = $1`, [id]);
        return result.rows[0] && rowToSkill(result.rows[0]);
    }

    async save(draft : SkillDraft) : Promise<Skill> {
        const result = await this.pool.query(
            `INSERT INTO anbaric_system.skills (id, title, usage_hints, body)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE
                 SET title = EXCLUDED.title, usage_hints = EXCLUDED.usage_hints, body = EXCLUDED.body, updated_at = now()
             RETURNING ${COLUMNS}`,
            [draft.id, draft.title, draft.usageHints, draft.body]);
        return rowToSkill(result.rows[0]);
    }

    async remove(id : string) : Promise<boolean> {
        const result = await this.pool.query("DELETE FROM anbaric_system.skills WHERE id = $1", [id]);
        return (result.rowCount ?? 0) > 0;
    }

}

export { PostgresSkillStore };
