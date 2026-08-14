import {
    CreateSecretCommand,
    DeleteSecretCommand,
    GetSecretValueCommand,
    ListSecretsCommand,
    PutSecretValueCommand,
    ResourceExistsException,
    ResourceNotFoundException,
    SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import {SecretStore} from "anbaric-tsapi";

class SecretsManagerSecretStore implements SecretStore {

    constructor(private client : SecretsManagerClient, private prefix : string = "anbaric/") {}

    async save(name : string, value : string) : Promise<void> {
        try {
            await this.client.send(new CreateSecretCommand({ Name: this.prefix + name, SecretString: value }));
        } catch (error) {
            if (!(error instanceof ResourceExistsException)) throw error;
            await this.client.send(new PutSecretValueCommand({ SecretId: this.prefix + name, SecretString: value }));
        }
    }

    async retrieve(name : string) : Promise<string> {
        try {
            const secret = await this.client.send(new GetSecretValueCommand({ SecretId: this.prefix + name }));
            return secret.SecretString ?? "";
        } catch (error) {
            if (error instanceof ResourceNotFoundException) throw new Error(`No secret found with name "${name}"`);
            throw error;
        }
    }

    async delete(name : string) : Promise<void> {
        try {
            await this.client.send(new DeleteSecretCommand({ SecretId: this.prefix + name, ForceDeleteWithoutRecovery: true }));
        } catch (error) {
            if (!(error instanceof ResourceNotFoundException)) throw error;
        }
    }

    async list() : Promise<Array<string>> {
        const result = await this.client.send(new ListSecretsCommand({
            Filters: [{ Key: "name", Values: [this.prefix] }],
        }));

        return (result.SecretList ?? [])
            .map(secret => secret.Name ?? "")
            .filter(name => name.startsWith(this.prefix))
            .map(name => name.slice(this.prefix.length));
    }

}

export { SecretsManagerSecretStore }
