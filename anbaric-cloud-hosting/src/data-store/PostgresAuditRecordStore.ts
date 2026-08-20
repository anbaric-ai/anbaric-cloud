import {AuditRecord} from "anbaric-tsapi";
import {Pool} from "pg";
import {AuditFilter, AuditRecordStore} from "../auditing/AuditRecordStore";

/* The writes worth keeping in the durable trail; reads (READ, LIST, QUERY) are
   dropped by default. Interactions are plain strings chosen by each store. */
const DEFAULT_WRITE_MASK : Array<string> = ["CREATE", "SAVE", "UPDATE_PROPERTIES", "CHANGE_STATE", "DELETE", "EXECUTE"];

/* Persists audit records, subject to a write mask: only the interactions in
   the mask are stored, so high-volume reads can be audited at the call site
   yet kept out of the durable trail. The mask defaults to every write and is
   overridable via ANBARIC_AUDIT_INTERACTIONS. */
class PostgresAuditRecordStore implements AuditRecordStore {

    private writeMask : Set<string>;

    constructor(private pool : Pool, writeMask : Set<string> = PostgresAuditRecordStore.maskFromEnvironment()) {
        this.writeMask = writeMask;
    }

    static maskFromEnvironment() : Set<string> {
        const configured = process.env.ANBARIC_AUDIT_INTERACTIONS;
        if (!configured) return new Set(DEFAULT_WRITE_MASK);
        return new Set(configured.split(",").map(entry => entry.trim()).filter(Boolean) );
    }

    async save(record : AuditRecord) : Promise<void> {
        if (!record.interaction.some(interaction => this.writeMask.has(interaction))) return;

        await this.pool.query(
            `INSERT INTO anbaric_system.audit_records
                (resource_type, resource_id, actor_id, actor_type, interaction, description, details)
             VALUES ($1, $2, $3, $4, $5::text[], $6, $7)`,
            [record.resourceType, record.resourceId, record.actorId, record.actorType, record.interaction,
                record.description, JSON.stringify(record.details ?? null)],
        );
    }

    async list(filter : AuditFilter) : Promise<Array<AuditRecord>> {
        const conditions : Array<string> = [];
        const parameters : Array<any> = [];

        if (filter.resourceType) {
            parameters.push(filter.resourceType);
            conditions.push(`resource_type = $${parameters.length}`);
        }
        if (filter.resourceId) {
            parameters.push(filter.resourceId);
            conditions.push(`resource_id = $${parameters.length}`);
        }
        if (filter.actorId) {
            parameters.push(filter.actorId);
            conditions.push(`actor_id = $${parameters.length}`);
        }
        if (filter.interaction) {
            parameters.push(filter.interaction);
            conditions.push(`$${parameters.length}::text = ANY(interaction)`);
        }
        if (filter.search) {
            parameters.push(`%${filter.search}%`);
            conditions.push(`description ILIKE $${parameters.length}`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        parameters.push(filter.pageSize ?? 100);
        const limit = `LIMIT $${parameters.length}`;
        parameters.push((filter.page ?? 0) * (filter.pageSize ?? 100));
        const offset = `OFFSET $${parameters.length}`;

        const result = await this.pool.query(
            `SELECT id, resource_type, resource_id, actor_id, actor_type, interaction, description, details, at
             FROM anbaric_system.audit_records ${where}
             ORDER BY at DESC, id DESC ${limit} ${offset}`,
            parameters,
        );

        return result.rows.map(row => ({
            id: String(row.id),
            resourceType: row.resource_type,
            resourceId: row.resource_id,
            actorId: row.actor_id,
            actorType: row.actor_type,
            interaction: row.interaction,
            description: row.description,
            details: row.details,
            at: row.at.toISOString(),
        }));
    }

}

export { PostgresAuditRecordStore }
