import {beforeEach, describe, expect, it, vi} from "vitest";
import {
    CreateSecretCommand,
    GetSecretValueCommand,
    ListSecretsCommand,
    PutSecretValueCommand,
    ResourceExistsException,
    ResourceNotFoundException,
    SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import {SecretsManagerSecretStore} from "../src/SecretsManagerSecretStore";

const notFound = () => new ResourceNotFoundException({ message: "not found", $metadata: {} });
const alreadyExists = () => new ResourceExistsException({ message: "exists", $metadata: {} });

describe("SecretsManagerSecretStore", () => {

    let send : ReturnType<typeof vi.fn>;
    let store : SecretsManagerSecretStore;

    beforeEach(() => {
        send = vi.fn(async () => ({}));
        store = new SecretsManagerSecretStore({ send } as unknown as SecretsManagerClient);
    });

    it("creates a new prefixed secret on save", async () => {
        await store.save("api-key", "s3cr3t");

        expect(send).toHaveBeenCalledOnce();
        const command = send.mock.calls[0][0] as CreateSecretCommand;
        expect(command).toBeInstanceOf(CreateSecretCommand);
        expect(command.input).toEqual({ Name: "anbaric/api-key", SecretString: "s3cr3t" });
    });

    it("updates the value when the secret already exists", async () => {
        send.mockRejectedValueOnce(alreadyExists());

        await store.save("api-key", "s3cr3t");

        const update = send.mock.calls[1][0] as PutSecretValueCommand;
        expect(update).toBeInstanceOf(PutSecretValueCommand);
        expect(update.input).toEqual({ SecretId: "anbaric/api-key", SecretString: "s3cr3t" });
    });

    it("retrieves a secret's value", async () => {
        send.mockResolvedValueOnce({ SecretString: "s3cr3t" });

        expect(await store.retrieve("api-key")).toBe("s3cr3t");
        const command = send.mock.calls[0][0] as GetSecretValueCommand;
        expect(command.input).toEqual({ SecretId: "anbaric/api-key" });
    });

    it("maps a missing secret to the standard not-found error", async () => {
        send.mockRejectedValueOnce(notFound());

        await expect(store.retrieve("missing")).rejects.toThrowError('No secret found with name "missing"');
    });

    it("tolerates deleting an unknown secret", async () => {
        send.mockRejectedValueOnce(notFound());

        await expect(store.delete("missing")).resolves.toBeUndefined();
    });

    it("lists secret names with the prefix stripped", async () => {
        send.mockResolvedValueOnce({ SecretList: [{ Name: "anbaric/api-key" }, { Name: "anbaric/db-password" }] });

        expect(await store.list()).toEqual(["api-key", "db-password"]);
        expect(send.mock.calls[0][0]).toBeInstanceOf(ListSecretsCommand);
    });

});
