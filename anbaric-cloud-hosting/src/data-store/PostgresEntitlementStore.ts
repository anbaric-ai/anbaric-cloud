import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {EntitlementDefinition, EntitlementGrant, EntitlementStore} from "./EntitlementStore";

class PostgresEntitlementStore implements EntitlementStore {

    constructor(private pool : Pool) {}

    async register(appId : string, entitlementId : string, notes : string = "") : Promise<void> {
        await this.upsertDefinition(appId, entitlementId, notes);
    }

    async has(appId : string, userId : string, entitlementId : string) : Promise<boolean> {
        const result = await this.pool.query(
            `SELECT 1 FROM entitlement_grants
             WHERE user_id = $1 AND entitlement_id = $2 AND (app_id = $3 OR app_id IS NULL)
             LIMIT 1`,
            [userId, entitlementId, appId]);
        return (result.rowCount ?? 0) > 0;
    }

    async defineGlobal(entitlementId : string, notes : string) : Promise<void> {
        await this.upsertDefinition(null, entitlementId, notes);
    }

    async listDefinitions() : Promise<Array<EntitlementDefinition>> {
        const result = await this.pool.query(
            `SELECT app_id, entitlement_id, notes FROM entitlements
             ORDER BY app_id NULLS FIRST, entitlement_id`);
        return result.rows.map(row => ({ appId: row.app_id, entitlementId: row.entitlement_id, notes: row.notes }));
    }

    async grant(userId : string, appId : string | null, entitlementId : string, notes : string, grantedBy : string) : Promise<EntitlementGrant> {
        const id = randomUUID();
        const result = await this.pool.query(
            `INSERT INTO entitlement_grants (id, user_id, app_id, entitlement_id, notes, granted_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING granted_at`,
            [id, userId, appId, entitlementId, notes, grantedBy]);
        return { id, userId, appId, entitlementId, notes, grantedBy, grantedAt: this.iso(result.rows[0]?.granted_at) };
    }

    async revoke(grantId : string) : Promise<boolean> {
        const result = await this.pool.query("DELETE FROM entitlement_grants WHERE id = $1", [grantId]);
        return (result.rowCount ?? 0) > 0;
    }

    async listGrants(userId? : string) : Promise<Array<EntitlementGrant>> {
        const result = userId === undefined
            ? await this.pool.query(
                `SELECT id, user_id, app_id, entitlement_id, notes, granted_at, granted_by
                 FROM entitlement_grants ORDER BY granted_at DESC`)
            : await this.pool.query(
                `SELECT id, user_id, app_id, entitlement_id, notes, granted_at, granted_by
                 FROM entitlement_grants WHERE user_id = $1 ORDER BY granted_at DESC`, [userId]);
        return result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            appId: row.app_id,
            entitlementId: row.entitlement_id,
            notes: row.notes,
            grantedAt: this.iso(row.granted_at),
            grantedBy: row.granted_by,
        }));
    }

    private async upsertDefinition(appId : string | null, entitlementId : string, notes : string) : Promise<void> {
        await this.pool.query(
            `INSERT INTO entitlements (app_id, entitlement_id, notes)
             VALUES ($1, $2, $3)
             ON CONFLICT (COALESCE(app_id, ''), entitlement_id) DO UPDATE SET notes = EXCLUDED.notes`,
            [appId, entitlementId, notes]);
    }

    private iso(value : unknown) : string {
        return value instanceof Date ? value.toISOString() : String(value ?? new Date().toISOString());
    }

}

export { PostgresEntitlementStore }
