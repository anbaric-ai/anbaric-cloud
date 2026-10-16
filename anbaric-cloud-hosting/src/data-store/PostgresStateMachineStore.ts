import {Pool} from "pg";
import {definitionHash, isNewVersion, RegisteredStateMachine, StateMachineRegistration, StateMachineStore, UNKNOWN_HASH} from "./StateMachineStore";

const COLUMNS = "app_id, workflow_id, url, version, hash, definition, registered_at, last_registered";

const rowToMachine = (row : any) : RegisteredStateMachine => ({
    ...(row.app_id ? { appId: row.app_id } : {}),
    workflowId: row.workflow_id,
    ...(row.url ? { url: row.url } : {}),
    version: Number(row.version),
    hash: row.hash,
    ...(row.definition ? { definition: row.definition } : {}),
    registeredAt: new Date(row.registered_at),
    lastRegistered: new Date(row.last_registered),
});

/* Versions of a machine are rows sharing its (app, workflow) key; the latest
   is the highest version. Registering compares against that one and either
   touches it or adds the next. */
class PostgresStateMachineStore implements StateMachineStore {

    constructor(private pool : Pool) {}

    async register(registration : StateMachineRegistration) : Promise<RegisteredStateMachine> {
        const { appId, workflowId, url, definition } = registration;
        const hash = definitionHash(definition);
        const latest = await this.latestOf(appId, workflowId);

        if (latest && ! isNewVersion(latest.hash, hash)) {
            const adopts = latest.hash === UNKNOWN_HASH && hash !== UNKNOWN_HASH;
            const result = await this.pool.query(
                `UPDATE anbaric_system.state_machines
                 SET url = $3, last_registered = now(),
                     hash = CASE WHEN $5::boolean THEN $4 ELSE hash END,
                     definition = CASE WHEN $5::boolean THEN $6::jsonb ELSE definition END
                 WHERE COALESCE(app_id, '') = $1 AND workflow_id = $2 AND version = $7
                 RETURNING ${COLUMNS}`,
                [appId ?? "", workflowId, url, hash, adopts, definition === undefined ? null : JSON.stringify(definition), latest.version]);
            return rowToMachine(result.rows[0]);
        }

        const result = await this.pool.query(
            `INSERT INTO anbaric_system.state_machines (app_id, workflow_id, url, version, hash, definition)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb)
             RETURNING ${COLUMNS}`,
            [appId ?? null, workflowId, url, (latest?.version ?? 0) + 1, hash, definition === undefined ? null : JSON.stringify(definition)]);
        return rowToMachine(result.rows[0]);
    }

    async list() : Promise<Array<RegisteredStateMachine>> {
        const result = await this.pool.query(
            `SELECT ${COLUMNS} FROM (
                 SELECT DISTINCT ON (COALESCE(app_id, ''), workflow_id) ${COLUMNS}
                 FROM anbaric_system.state_machines
                 ORDER BY COALESCE(app_id, ''), workflow_id, version DESC
             ) latest
             ORDER BY last_registered DESC`);
        return result.rows.map(rowToMachine);
    }

    private async latestOf(appId : string | undefined, workflowId : string) : Promise<RegisteredStateMachine | undefined> {
        const result = await this.pool.query(
            `SELECT ${COLUMNS} FROM anbaric_system.state_machines
             WHERE COALESCE(app_id, '') = $1 AND workflow_id = $2
             ORDER BY version DESC LIMIT 1`,
            [appId ?? "", workflowId]);
        return result.rows[0] ? rowToMachine(result.rows[0]) : undefined;
    }

}

export { PostgresStateMachineStore };
