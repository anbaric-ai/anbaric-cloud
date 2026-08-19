import {PlatformClient} from "../PlatformClient";
import {bold, dim, green, red, yellow} from "../ui/Ansi";

const colourForStatus : Record<string, (text : string) => string> = {
    running: green,
    building: yellow,
    failed: red,
    stopped: dim,
};

type AppStatus = {
    appName : string,
    status : string,
    appPort : number,
    appHost : string,
    live : boolean,
    log? : Array<string>,
};

class AppStatusCommand {

    constructor(private client : PlatformClient) {}

    async run(appName : string) : Promise<number> {
        const app = await this.client.get(`/apps/${encodeURIComponent(appName)}`) as AppStatus;

        const status = (colourForStatus[app.status] ?? dim)(app.status);
        const admin = app.live ? green("up") : red("down");
        console.log(`${bold(app.appName)}  deploy ${status}  admin ${admin}`);
        console.log(dim(`  ${app.appHost}:${app.appPort}`));

        if (app.log && app.log.length > 0) {
            console.log(dim("  recent:"));
            for (const line of app.log.slice(-5)) console.log(dim(`    ${line}`));
        }
        return 0;
    }

}

export { AppStatusCommand }
