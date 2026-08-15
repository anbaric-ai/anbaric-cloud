import {parseArgs} from "node:util";
import {CliConfig, platformUrlForEnvironment} from "./CliConfig";
import {PlatformClient} from "./PlatformClient";
import {choosePlatformUrl} from "./PlatformPicker";
import {AppsCommand} from "./commands/AppsCommand";
import {ConfigureCommand} from "./commands/ConfigureCommand";
import {DeployCommand} from "./commands/DeployCommand";
import {JobsCommand} from "./commands/JobsCommand";
import {JobSetStateCommand} from "./commands/JobSetStateCommand";
import {JobUpdateCommand} from "./commands/JobUpdateCommand";
import {LoginCommand} from "./commands/LoginCommand";
import {LogoutCommand} from "./commands/LogoutCommand";
import {StateMachinesCommand} from "./commands/StateMachinesCommand";
import {WatchCommand} from "./commands/WatchCommand";
import {bold, dim, red} from "./ui/Ansi";

const usage = () => {
    console.log(`${bold("anbaric")} — the Anbaric platform CLI

${bold("Usage")}
  anbaric login                                 configure platform URL and authorize this terminal
  anbaric logout                                revoke this terminal's key and remove it
  anbaric configure [dir]                       create or update the app's .anbaric/app-config.json
  anbaric deploy [dir]                          deploy an app (defaults to the current directory)
  anbaric update [dir]                          deploy, replacing a running app without prompting
  anbaric apps                                  list deployed apps
  anbaric state-machines                        list registered state machines
  anbaric job list [state-machine-id]           list jobs, optionally for one state machine
  anbaric job watch <job-id>                    follow a job's state live
  anbaric job set-state <job-id> <state>        move a job to a state and re-queue it
  anbaric job update <job-id> <key=value ...>   update job properties and re-queue it

${bold("Options")} ${dim("(every interactive prompt has a flag, for scripts and agents)")}
  --platform-url <url>                          platform to talk to ${dim("(login sets the default)")}
  --tenant <tenant>                             tenant to act as ${dim("(login sets the default)")}
  --environment <local|staging|production>      derive the platform URL from the tenant, skipping the picker
  --yes                                         deploy: replace a running app without asking
  --name <name>                                 configure: app name, skipping the prompt
  --port <port>                                 configure: internal port, skipping the prompt`);
};

const {values, positionals} = parseArgs({
    args: process.argv.slice(2),
    options: {
        "platform-url": { type: "string" },
        "tenant": { type: "string" },
        "environment": { type: "string" },
        "yes": { type: "boolean" },
        "name": { type: "string" },
        "port": { type: "string" },
    },
    allowPositionals: true,
});

const [command, ...commandArgs] = positionals;
const flags = { platformUrl: values["platform-url"], tenant: values.tenant };

const clientFromConfig = async () => {
    const options = await CliConfig.resolve(flags);
    if (!flags.platformUrl && values.environment) {
        const platformUrl = platformUrlForEnvironment(values.environment, options.tenant);
        return new PlatformClient(await CliConfig.resolve({ ...flags, platformUrl }));
    }
    return new PlatformClient(options);
};

const clientForDeploy = async () => {
    const options = await CliConfig.resolve(flags);
    if (flags.platformUrl || values.environment) return clientFromConfig();
    if (!options.tenant || !process.stdout.isTTY) return new PlatformClient(options);

    const platformUrl = await choosePlatformUrl(options.tenant);
    return new PlatformClient(await CliConfig.resolve({ ...flags, platformUrl }));
};

const configureCommand = () => new ConfigureCommand({
    name: values.name,
    port: values.port === undefined ? undefined : Number(values.port),
});

const fail = (message : string) : number => {
    console.error(red(message));
    return 1;
};

const runJobCommand = async (args : Array<string>) : Promise<number> => {
    const [subcommand, jobId, ...rest] = args;

    switch (subcommand) {
        case "list":
            return new JobsCommand(await clientFromConfig()).run(jobId);
        case "watch":
            if (!jobId) return fail("usage: anbaric job watch <job-id>");
            return new WatchCommand(await clientFromConfig()).run(jobId);
        case "set-state":
            if (!jobId || !rest[0]) return fail("usage: anbaric job set-state <job-id> <state>");
            return new JobSetStateCommand(await clientFromConfig()).run(jobId, rest[0]);
        case "update":
            if (!jobId || rest.length === 0) return fail("usage: anbaric job update <job-id> <key=value ...>");
            return new JobUpdateCommand(await clientFromConfig()).run(jobId, rest);
        default:
            usage();
            return 1;
    }
};

try {
    switch (command) {
        case "login":
            process.exit(await new LoginCommand().run(flags, values.environment));
        case "logout":
            process.exit(await new LogoutCommand().run());
        case "configure":
            process.exit(await configureCommand().run(commandArgs[0] ?? "."));
        case "deploy":
            process.exit(await new DeployCommand(await clientForDeploy(), values.yes ?? false, configureCommand()).run(commandArgs[0] ?? "."));
        case "update":
            process.exit(await new DeployCommand(await clientForDeploy(), true, configureCommand()).run(commandArgs[0] ?? "."));
        case "apps":
            process.exit(await new AppsCommand(await clientFromConfig()).run());
        case "state-machines":
            process.exit(await new StateMachinesCommand(await clientFromConfig()).run());
        case "job":
            process.exit(await runJobCommand(commandArgs));
        default:
            usage();
            process.exit(command ? 1 : 0);
    }
} catch (error) {
    console.error(red(`✗ ${error instanceof Error ? error.message : error}`));
    process.exit(1);
}
