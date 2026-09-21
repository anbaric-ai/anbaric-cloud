import {randomUUID} from "node:crypto";
import {EntitlementDefinition, EntitlementGrant, EntitlementStore} from "./EntitlementStore";

class InMemoryEntitlementStore implements EntitlementStore {

    private definitions = new Map<string, EntitlementDefinition>();
    private grants = new Map<string, EntitlementGrant>();

    constructor() {
        this.definitions.set(this.key(null, "access"), { appId: null, entitlementId: "access", notes: "Global access" });
    }

    async register(appId : string, entitlementId : string, notes : string = "") : Promise<void> {
        this.definitions.set(this.key(appId, entitlementId), { appId, entitlementId, notes });
    }

    async has(appId : string, userId : string, entitlementId : string) : Promise<boolean> {
        return Array.from(this.grants.values()).some(grant =>
            grant.userId === userId && grant.entitlementId === entitlementId &&
            (grant.appId === null || grant.appId === appId));
    }

    async defineGlobal(entitlementId : string, notes : string) : Promise<void> {
        this.definitions.set(this.key(null, entitlementId), { appId: null, entitlementId, notes });
    }

    async listDefinitions() : Promise<Array<EntitlementDefinition>> {
        return Array.from(this.definitions.values()).map(definition => ({ ...definition }));
    }

    async grant(userId : string, appId : string | null, entitlementId : string, notes : string, grantedBy : string) : Promise<EntitlementGrant> {
        const grant : EntitlementGrant = {
            id: randomUUID(), userId, appId, entitlementId, notes, grantedBy, grantedAt: new Date().toISOString(),
        };
        this.grants.set(grant.id, grant);
        return { ...grant };
    }

    async revoke(grantId : string) : Promise<boolean> {
        return this.grants.delete(grantId);
    }

    async listGrants(userId? : string) : Promise<Array<EntitlementGrant>> {
        return Array.from(this.grants.values())
            .filter(grant => userId === undefined || grant.userId === userId)
            .map(grant => ({ ...grant }));
    }

    private key(appId : string | null, entitlementId : string) : string {
        return `${appId ?? ""}/${entitlementId}`;
    }

}

export { InMemoryEntitlementStore }
