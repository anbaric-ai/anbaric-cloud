import {PlatformClient} from "../PlatformClient";
import {bold, dim} from "../ui/Ansi";
import {renderTable} from "../ui/Table";

type StateCount = { state : string, killed : boolean, count : number };

class JobStatsCommand {

    constructor(private client : PlatformClient) {}

    async run() : Promise<number> {
        const { states } = await this.client.get("/jobs/stats") as { states : Array<StateCount> };
        const { size } = await this.client.get("/queue/size") as { size : number };

        const byState = new Map<string, { active : number, killed : number }>();
        for (const row of states) {
            const entry = byState.get(row.state) ?? { active: 0, killed: 0 };
            if (row.killed) entry.killed += row.count;
            else entry.active += row.count;
            byState.set(row.state, entry);
        }

        if (byState.size === 0) {
            console.log(dim("No jobs on this platform"));
        } else {
            console.log(renderTable(
                ["STATE", "ACTIVE", "KILLED"],
                [...byState.entries()]
                    .sort((a, b) => (b[1].active + b[1].killed) - (a[1].active + a[1].killed))
                    .map(([state, counts]) => [
                        bold(state),
                        String(counts.active),
                        counts.killed ? String(counts.killed) : dim("0"),
                    ]),
            ));
        }

        console.log(`${dim("queue:")} ${bold(String(size))} ${dim(size === 1 ? "message pending" : "messages pending")}`);
        return 0;
    }

}

export { JobStatsCommand }
