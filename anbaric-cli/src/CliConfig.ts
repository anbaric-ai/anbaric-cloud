import {mkdir, readFile, writeFile} from "node:fs/promises";
import {homedir} from "node:os";
import {join} from "node:path";

type CliOptions = {
    platformUrl : string,
    tenant? : string,
    key? : StoredKey,
};

type CliFlags = {
    platformUrl? : string,
    tenant? : string,
};

type StoredKey = {
    platformUrl : string,
    keyId : string,
    clientName : string,
    publicKey : string,
    privateKey : string,
};

const DEFAULT_PLATFORM_URL = "http://localhost:8787";

const configDir = () => process.env.ANBARIC_CONFIG_DIR ?? join(homedir(), ".anbaric");

const CliConfig = {

    async load() : Promise<CliFlags> {
        try {
            return JSON.parse(await readFile(join(configDir(), "config.json"), "utf8"));
        } catch {
            return {};
        }
    },

    async save(options : CliFlags) : Promise<string> {
        await mkdir(configDir(), { recursive: true });
        const path = join(configDir(), "config.json");
        await writeFile(path, JSON.stringify(options, null, 2));
        return path;
    },

    async resolve(flags : CliFlags) : Promise<CliOptions> {
        const stored = await CliConfig.load();
        const platformUrl = flags.platformUrl ?? process.env.ANBARIC_CLOUD_URL ?? stored.platformUrl ?? DEFAULT_PLATFORM_URL;
        const key = await CliConfig.loadKey();
        return {
            platformUrl,
            tenant: flags.tenant ?? process.env.ANBARIC_TENANT ?? stored.tenant,
            key: key?.platformUrl === platformUrl ? key : undefined,
        };
    },

    async saveKey(key : StoredKey) : Promise<string> {
        await mkdir(configDir(), { recursive: true });
        const path = join(configDir(), "key.json");
        await writeFile(path, JSON.stringify(key, null, 2), { mode: 0o600 });
        return path;
    },

    async loadKey() : Promise<StoredKey | undefined> {
        try {
            return JSON.parse(await readFile(join(configDir(), "key.json"), "utf8"));
        } catch {
            return undefined;
        }
    },

};

export { CliConfig, DEFAULT_PLATFORM_URL };
export type { CliFlags, CliOptions, StoredKey };
