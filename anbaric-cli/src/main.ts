#!/usr/bin/env -S npx tsx
import {parseArgs} from "node:util";
import {CliConfig} from "./CliConfig";
import {PlatformClient} from "./PlatformClient";
import {AppsCommand} from "./commands/AppsCommand";
import {ConfigureCommand} from "./commands/ConfigureCommand";
import {DeployCommand} from "./commands/DeployCommand";
import {JobsCommand} from "./commands/JobsCommand";
import {LoginCommand} from "./commands/LoginCommand";
import {StateMachinesCommand} from "./commands/StateMachinesCommand";
import {WatchCommand} from "./commands/WatchCommand";
import {bold, dim, red} from "./ui/Ansi";

const usage = () => {
    console.log(`${bold("anbaric")} — the Anbaric platform CLI

${bold("Usage")}
  anbaric login                        configure platform URL and tenant
  anbaric configure [dir]              create or update the app's .anbaric/app-config.json
  anbaric deploy [dir]                 deploy an app (defaults to the current directory)
  anbaric update [dir]                 deploy, replacing a running app without prompting
  anbaric apps                         list deployed apps
  anbaric state-machines               list registered state machines
  anbaric jobs [state-machine-id]      list jobs, optionally for one state machine
  anbaric watch <job-id>               follow a job's state live

${bold("Options")}
  --platform-url <url>                 platform to talk to ${dim("(login sets the default)")}
  --tenant <tenant>                    tenant to act as ${dim("(login sets the default)")}`);
};

const {values, positionals} = parseArgs({
    args: process.argv.slice(2),
    options: {
        "platform-url": { type: "string" },
        "tenant": { type: "string" },
    },
    allowPositionals: true,
});

const [command, argument] = positionals;
const flags = { platformUrl: values["platform-url"], tenant: values.tenant };

const clientFromConfig = async () => new PlatformClient(await CliConfig.resolve(flags));

try {
    switch (command) {
        case "login":
            process.exit(await new LoginCommand().run(flags));
        case "configure":
            process.exit(await new ConfigureCommand().run(argument ?? "."));
        case "deploy":
            process.exit(await new DeployCommand(await clientFromConfig()).run(argument ?? "."));
        case "update":
            process.exit(await new DeployCommand(await clientFromConfig(), true).run(argument ?? "."));
        case "apps":
            process.exit(await new AppsCommand(await clientFromConfig()).run());
        case "state-machines":
            process.exit(await new StateMachinesCommand(await clientFromConfig()).run());
        case "jobs":
            process.exit(await new JobsCommand(await clientFromConfig()).run(argument));
        case "watch":
            if (!argument) {
                console.error(red("watch needs a job id: anbaric watch <job-id>"));
                process.exit(1);
            }
            process.exit(await new WatchCommand(await clientFromConfig()).run(argument));
        default:
            usage();
            process.exit(command ? 1 : 0);
    }
} catch (error) {
    console.error(red(`✗ ${error instanceof Error ? error.message : error}`));
    process.exit(1);
}
