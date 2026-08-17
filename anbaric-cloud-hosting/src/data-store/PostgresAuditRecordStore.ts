import {AuditRecord} from "anbaric-tsapi";
import {Pool} from "pg";
import {AuditFilter, AuditRecordStore} from "../auditing/AuditRecordStore";

class PostgresAuditRecordStore implements AuditRecordStore {

    constructor(private pool : Pool) {}

    async save(record : AuditRecord) : Promise<void> {
        await this.pool.query(
            `INSERT INTO anbaric_system.audit_records (job_id, actor_id, actor_type, change, description, details)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [record.jobId, record.actorId, record.actorType, record.change,
                record.description, JSON.stringify(record.details ?? null)],
        );
    }

    async list(filter : AuditFilter) : Promise<Array<AuditRecord>> {
        const conditions : Array<string> = [];
        const parameters : Array<any> = [];

        if (filter.jobId) {
            parameters.push(filter.jobId);
            conditions.push(`job_id = $${parameters.length}`);
        }
        if (filter.actorId) {
            parameters.push(filter.actorId);
            conditions.push(`actor_id = $${parameters.length}`);
        }
        if (filter.change) {
            parameters.push(filter.change);
            conditions.push(`change = $${parameters.length}::anbaric_system.audit_change`);
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
            `SELECT id, job_id, actor_id, actor_type, change, description, details, at
             FROM anbaric_system.audit_records ${where}
             ORDER BY at DESC, id DESC ${limit} ${offset}`,
            parameters,
        );

        return result.rows.map(row => ({
            id: String(row.id),
            jobId: row.job_id,
            actorId: row.actor_id,
            actorType: row.actor_type,
            change: row.change,
            description: row.description,
            details: row.details,
            at: row.at.toISOString(),
        }));
    }

}

export { PostgresAuditRecordStore }
