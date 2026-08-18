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
import {Auditor, NoOpAuditor, SecretStore} from "anbaric-tsapi";

class SecretsManagerSecretStore extends SecretStore {

    constructor(private client : SecretsManagerClient, private prefix : string = "anbaric/",
                auditor : Auditor = new NoOpAuditor()) {
        super(auditor);
    }

    protected async saveInternal(name : string, value : string) : Promise<void> {
        try {
            await this.client.send(new CreateSecretCommand({ Name: this.prefix + name, SecretString: value }));
        } catch (error) {
            if (!(error instanceof ResourceExistsException)) throw error;
            await this.client.send(new PutSecretValueCommand({ SecretId: this.prefix + name, SecretString: value }));
        }
    }

    protected async retrieveInternal(name : string) : Promise<string> {
        try {
            const secret = await this.client.send(new GetSecretValueCommand({ SecretId: this.prefix + name }));
            return secret.SecretString ?? "";
        } catch (error) {
            if (error instanceof ResourceNotFoundException) throw new Error(`No secret found with name "${name}"`);
            throw error;
        }
    }

    protected async deleteInternal(name : string) : Promise<void> {
        try {
            await this.client.send(new DeleteSecretCommand({ SecretId: this.prefix + name, ForceDeleteWithoutRecovery: true }));
        } catch (error) {
            if (!(error instanceof ResourceNotFoundException)) throw error;
        }
    }

    protected async listInternal() : Promise<Array<string>> {
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
