import {Pool} from "pg";
import {User} from "../auth/User";
import {DirectoryUser, UserDirectory} from "../auth/UserDirectory";

class PostgresUserDirectory implements UserDirectory {

    constructor(private pool : Pool) {}

    async record(user : User) : Promise<void> {
        await this.pool.query(
            `INSERT INTO anbaric_system.users (id, name, email, picture)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE
             SET name = EXCLUDED.name, email = EXCLUDED.email, picture = EXCLUDED.picture, last_seen = now()`,
            [user.id, user.name ?? "", user.email ?? "", user.picture ?? null]);
    }

    async list() : Promise<Array<DirectoryUser>> {
        const result = await this.pool.query(
            `SELECT id, name, email, picture, first_seen, last_seen
             FROM anbaric_system.users
             ORDER BY NULLIF(name, '') NULLS LAST, id`);
        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            email: row.email,
            picture: row.picture ?? undefined,
            firstSeenAt: this.iso(row.first_seen),
            lastSeenAt: this.iso(row.last_seen),
        }));
    }

    private iso(value : unknown) : string {
        return value instanceof Date ? value.toISOString() : String(value ?? "");
    }

}

export { PostgresUserDirectory }
