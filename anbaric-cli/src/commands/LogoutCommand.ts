import {CliConfig} from "../CliConfig";
import {PlatformClient} from "../PlatformClient";
import {bold, check, dim} from "../ui/Ansi";

class LogoutCommand {

    async run() : Promise<number> {
        const key = await CliConfig.loadKey();
        if (!key) {
            console.log(dim("This terminal holds no key, so there is nothing to log out of"));
            return 0;
        }

        try {
            await new PlatformClient({ platformUrl: key.platformUrl, key }).delete(`/keys/${encodeURIComponent(key.keyId)}`);
            console.log(`${check} Revoked ${bold(key.clientName)} on ${bold(key.platformUrl)}`);
        } catch (error) {
            console.log(dim(`  could not revoke the key on the platform (${error instanceof Error ? error.message : error}) - removing it locally anyway`));
        }

        await CliConfig.deleteKey();
        const stored = await CliConfig.load();
        await CliConfig.save({ platformUrl: stored.platformUrl });

        console.log(`${check} Logged out - the keypair has been removed from this machine`);
        return 0;
    }

}

export { LogoutCommand }
