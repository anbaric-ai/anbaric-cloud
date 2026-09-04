import {CliConfig} from "../../../anbaric-cli/src/CliConfig";
import {PlatformClient} from "../../../anbaric-cli/src/PlatformClient";

// Same credentials, base URL and signed-token auth the `anbaric` CLI uses:
// resolved from ~/.anbaric plus any ANBARIC_CLOUD_URL / ANBARIC_TENANT override.
const anbaricClient = async () : Promise<PlatformClient> =>
    new PlatformClient(await CliConfig.resolve({}));

const actorName = async () : Promise<string> => {
    const key = await CliConfig.loadKey();
    return key ? `mcp:${key.clientName}` : "anbaric-mcp";
};

export {anbaricClient, actorName};
