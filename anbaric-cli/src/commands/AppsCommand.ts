import {PlatformClient} from "../PlatformClient";
import {dim, green, red, yellow} from "../ui/Ansi";
import {renderTable} from "../ui/Table";

const colourForStatus : Record<string, (text : string) => string> = {
    running: green,
    building: yellow,
    failed: red,
    stopped: dim,
};

class AppsCommand {

    constructor(private client : PlatformClient) {}

    async run() : Promise<number> {
        const apps = await this.client.get("/apps") as Array<{ appName : string, status : string, appPort : number }>;

        if (apps.length === 0) {
            console.log(dim(`No apps deployed to ${this.client.platformUrl} — try "anbaric app deploy"`));
            return 0;
        }

        console.log(renderTable(
            ["APP", "STATUS", "PORT"],
            apps.map(app => [
                app.appName,
                (colourForStatus[app.status] ?? dim)(app.status),
                String(app.appPort),
            ]),
        ));
        return 0;
    }

}

export { AppsCommand }
