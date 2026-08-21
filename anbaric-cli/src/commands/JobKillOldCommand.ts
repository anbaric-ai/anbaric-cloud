import {PlatformClient} from "../PlatformClient";
import {bold, check, dim} from "../ui/Ansi";
import {confirm} from "../ui/Prompt";

const UNIT_MS : Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
};

const parseAge = (age : string) : number => {
    const match = /^(\d+)\s*([smhdw])$/.exec(age.trim());
    if (!match) {
        throw new Error(`"${age}" is not an age — use a number followed by s, m, h, d or w (e.g. 24h, 7d)`);
    }
    return Number(match[1]) * UNIT_MS[match[2]];
};

class JobKillOldCommand {

    constructor(private client : PlatformClient, private yes : boolean = false) {}

    async run(age : string) : Promise<number> {
        const before = new Date(Date.now() - parseAge(age));

        if (!this.yes && !await confirm(`Kill every job not updated in the last ${bold(age)} (before ${before.toISOString()}) on ${this.client.platformUrl}?`)) {
            console.error(dim("Aborted — pass --yes to kill without a prompt."));
            return 1;
        }

        const { killed } = await this.client.post("/jobs/kill-old", { before: before.toISOString() }) as { killed : number };
        console.log(`${check} killed ${bold(String(killed))} job${killed === 1 ? "" : "s"} not updated in the last ${age}`);
        return 0;
    }

}

export { JobKillOldCommand }
