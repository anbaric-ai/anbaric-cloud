import {definitionHash, isNewVersion, RegisteredStateMachine, StateMachineRegistration, StateMachineStore, UNKNOWN_HASH} from "./StateMachineStore";

class InMemoryStateMachineStore implements StateMachineStore {

    private versions = new Map<string, Array<RegisteredStateMachine>>();

    private key(appId : string | undefined, workflowId : string) : string {
        return JSON.stringify([appId || null, workflowId]);
    }

    async register(registration : StateMachineRegistration) : Promise<RegisteredStateMachine> {
        const hash = definitionHash(registration.definition);
        const held = this.versions.get(this.key(registration.appId, registration.workflowId)) ?? [];
        const latest = held.at(-1);
        const now = new Date();

        if (latest && ! isNewVersion(latest.hash, hash)) {
            latest.url = registration.url;
            latest.lastRegistered = now;
            if (latest.hash === UNKNOWN_HASH && hash !== UNKNOWN_HASH) {
                latest.hash = hash;
                latest.definition = registration.definition;
            }
            return { ...latest };
        }

        const machine : RegisteredStateMachine = {
            ...(registration.appId ? { appId: registration.appId } : {}),
            workflowId: registration.workflowId,
            url: registration.url,
            version: (latest?.version ?? 0) + 1,
            hash,
            ...(registration.definition ? { definition: registration.definition } : {}),
            registeredAt: now,
            lastRegistered: now,
        };
        this.versions.set(this.key(registration.appId, registration.workflowId), [...held, machine]);
        return { ...machine };
    }

    async list() : Promise<Array<RegisteredStateMachine>> {
        return Array.from(this.versions.values(), held => ({ ...held[held.length - 1] }))
            .sort((a, b) => b.lastRegistered.getTime() - a.lastRegistered.getTime());
    }

}

export { InMemoryStateMachineStore };
