import {PlatformClient} from "../PlatformClient";
import {dim, green} from "../ui/Ansi";
import {askHidden} from "../ui/Prompt";

const NAME_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/* An app's secrets, from the terminal: the names it holds, a new value for
   one, or one fewer. Values go in and never come out - the platform refuses to
   read one back to a person - so the only way to check a secret is to set it
   again. */
class SecretsCommand {

    constructor(private client : PlatformClient, private readValue : () => Promise<string> = () => askHidden("Value")) {}

    async list(appName : string) : Promise<number> {
        const names = await this.client.get("/secrets", this.scope(appName)) as Array<string>;

        if (names.length === 0) {
            console.log(dim(`${appName} has no secrets — set one with "anbaric secrets set <name>"`));
            return 0;
        }
        for (const name of names) console.log(name);
        return 0;
    }

    async set(appName : string, name : string) : Promise<number> {
        if (! NAME_SHAPE.test(name)) throw new Error(`"${name}" is not a secret name: letters, digits, dots, dashes and underscores`);

        const value = await this.readValue();
        if (! value) throw new Error("No value given");

        await this.client.put(`/secrets/${encodeURIComponent(name)}`, { value }, this.scope(appName));
        console.log(green(`✓ ${name} set for ${appName}`));
        return 0;
    }

    async delete(appName : string, name : string) : Promise<number> {
        await this.client.delete(`/secrets/${encodeURIComponent(name)}`, this.scope(appName));
        console.log(green(`✓ ${name} removed from ${appName}`));
        return 0;
    }

    private scope(appName : string) : Record<string, string> {
        return { "x-anbaric-app": appName };
    }

}

export { SecretsCommand }
