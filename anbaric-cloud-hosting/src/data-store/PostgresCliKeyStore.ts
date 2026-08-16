import {Pool} from "pg";
import {CliKey} from "../auth/CliKey";
import {CliKeyStore} from "../auth/CliKeyStore";

class PostgresCliKeyStore implements CliKeyStore {

    constructor(private pool : Pool) {}

    async save(key : CliKey) : Promise<void> {
        await this.pool.query(
            "INSERT INTO anbaric_system.cli_keys (id, user_id, client_name, public_key, tenant) VALUES ($1, $2, $3, $4, $5)",
            [key.id, key.userId, key.clientName, key.publicKey, key.tenant ?? null],
        );
    }

    async find(id : string) : Promise<CliKey | undefined> {
        const result = await this.pool.query(
            "SELECT id, user_id, client_name, public_key, tenant, created_at FROM anbaric_system.cli_keys WHERE id = $1",
            [id],
        );
        const row = result.rows[0];
        return row && new CliKey(row.id, row.user_id, row.client_name, row.public_key, row.tenant ?? undefined, row.created_at);
    }

    async listFor(userId : string) : Promise<Array<CliKey>> {
        const result = await this.pool.query(
            "SELECT id, user_id, client_name, public_key, tenant, created_at FROM anbaric_system.cli_keys WHERE user_id = $1 ORDER BY created_at",
            [userId],
        );

        return result.rows.map(row =>
            new CliKey(row.id, row.user_id, row.client_name, row.public_key, row.tenant ?? undefined, row.created_at));
    }

    async delete(id : string, userId : string) : Promise<void> {
        await this.pool.query(
            "DELETE FROM anbaric_system.cli_keys WHERE id = $1 AND user_id = $2",
            [id, userId],
        );
    }

}

export { PostgresCliKeyStore }
