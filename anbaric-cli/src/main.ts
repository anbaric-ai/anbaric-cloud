import {parseArgs} from "node:util";
import {CliConfig, platformUrlForEnvironment} from "./CliConfig";
import {PlatformClient} from "./PlatformClient";
import {choosePlatformUrl} from "./PlatformPicker";
import {AppsCommand} from "./commands/AppsCommand";
import {AppStatusCommand} from "./commands/AppStatusCommand";
import {AppTailCommand} from "./commands/AppTailCommand";
import {AppTearDownCommand} from "./commands/AppTearDownCommand";
import {ConfigureCommand} from "./commands/ConfigureCommand";
import {DeployCommand} from "./commands/DeployCommand";
import {JobsCommand} from "./commands/JobsCommand";
import {JobCreateCommand} from "./commands/JobCreateCommand";
import {JobSetStateCommand} from "./commands/JobSetStateCommand";
import {JobUpdateCommand} from "./commands/JobUpdateCommand";
import {LoginCommand} from "./commands/LoginCommand";
import {LogoutCommand} from "./commands/LogoutCommand";
import {StateMachinesCommand} from "./commands/StateMachinesCommand";
import {WatchCommand} from "./commands/WatchCommand";
import {findAppRoot} from "./findAppRoot";
import {bold, dim, red} from "./ui/Ansi";

const usage = () => {
    console.log(`${bold("anbaric")} — the Anbaric platform CLI

${bold("Usage")}
  anbaric login                                 configure platform URL and authorize this terminal
  anbaric logout                                revoke this terminal's key and remove it
  anbaric apps                                  list deployed apps
  anbaric app configure                         create or update the app's .anbaric/app-config.json
  anbaric app deploy                            deploy the app (run from anywhere inside the project)
  anbaric app update                            deploy, replacing a running app without prompting
  anbaric app status <name>                     show an app's deploy state and whether it is up
  anbaric app tail <name>                       stream an app's runtime logs to stdout (Ctrl-C to stop)
  anbaric app tear-down <name>                  stop and remove a deployed app (--yes to skip the prompt)
  anbaric state-machines                        list registered state machines
  anbaric jobs create <sm-id> <start-state> [k=v ...]  create a job and queue it for processing
  anbaric jobs list [state-machine-id]          list jobs, optionally for one state machine
  anbaric jobs watch <job-id>                   follow a job's state live
  anbaric jobs set-state <job-id> <state>       move a job to a state and re-queue it
  anbaric jobs update <job-id> <key=value ...>  update job properties and re-queue it

${bold("Options")} ${dim("(every interactive prompt has a flag, for scripts and agents)")}
  -h, --help                                    show this help
  --platform-url <url>                          platform to talk to ${dim("(login sets the default)")}
  --tenant <tenant>                             tenant to route to ${dim("(login learns it from your session)")}
  --environment <local|staging|production>      pick the platform without the interactive picker
  --yes                                         app deploy/tear-down: don't prompt before replacing or removing
  --name <name>                                 app configure: app name, skipping the prompt
  --port <port>                                 app configure: internal port, skipping the prompt`);
};

const parse = () => {
    try {
        return parseArgs({
            args: process.argv.slice(2),
            options: {
                "help": { type: "boolean", short: "h" },
                "platform-url": { type: "string" },
                "tenant": { type: "string" },
                "environment": { type: "string" },
                "yes": { type: "boolean" },
                "name": { type: "string" },
                "port": { type: "string" },
            },
            allowPositionals: true,
        });
    } catch {
        usage();
        process.exit(1);
    }
};

const {values, positionals} = parse();

if (values.help) {
    usage();
    process.exit(0);
}

const [command, ...commandArgs] = positionals;
const flags = { platformUrl: values["platform-url"], tenant: values.tenant };

const clientFromConfig = async () => {
    if (!flags.platformUrl && values.environment) {
        const platformUrl = platformUrlForEnvironment(values.environment);
        return new PlatformClient(await CliConfig.resolve({ ...flags, platformUrl }));
    }
    return new PlatformClient(await CliConfig.resolve(flags));
};

const clientForDeploy = async () => {
    if (flags.platformUrl || values.environment || !process.stdout.isTTY) return clientFromConfig();

    const platformUrl = await choosePlatformUrl();
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

const runAppCommand = async (args : Array<string>) : Promise<number> => {
    const [subcommand, appName] = args;

    switch (subcommand) {
        case "configure":
            return configureCommand().run(findAppRoot());
        case "deploy":
            return new DeployCommand(await clientForDeploy(), values.yes ?? false, configureCommand()).run(findAppRoot());
        case "update":
            return new DeployCommand(await clientForDeploy(), true, configureCommand()).run(findAppRoot());
        case "status":
            if (!appName) return fail("usage: anbaric app status <name>");
            return new AppStatusCommand(await clientFromConfig()).run(appName);
        case "tail":
            if (!appName) return fail("usage: anbaric app tail <name>");
            return new AppTailCommand(await clientFromConfig()).run(appName);
        case "tear-down":
        case "teardown":
            if (!appName) return fail("usage: anbaric app tear-down <name>");
            return new AppTearDownCommand(await clientFromConfig(), values.yes ?? false).run(appName);
        default:
            usage();
            return 1;
    }
};

const runJobCommand = async (args : Array<string>) : Promise<number> => {
    const [subcommand, jobId, ...rest] = args;

    switch (subcommand) {
        case "create":
            if (!jobId || !rest[0]) return fail("usage: anbaric jobs create <state-machine-id> <start-state> [key=value ...]");
            return new JobCreateCommand(await clientFromConfig()).run(jobId, rest[0], rest.slice(1));
        case "list":
            return new JobsCommand(await clientFromConfig()).run(jobId);
        case "watch":
            if (!jobId) return fail("usage: anbaric jobs watch <job-id>");
            return new WatchCommand(await clientFromConfig()).run(jobId);
        case "set-state":
            if (!jobId || !rest[0]) return fail("usage: anbaric jobs set-state <job-id> <state>");
            return new JobSetStateCommand(await clientFromConfig()).run(jobId, rest[0]);
        case "update":
            if (!jobId || rest.length === 0) return fail("usage: anbaric jobs update <job-id> <key=value ...>");
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
        case "apps":
            process.exit(await new AppsCommand(await clientFromConfig()).run());
        case "app":
            process.exit(await runAppCommand(commandArgs));
        case "state-machines":
            process.exit(await new StateMachinesCommand(await clientFromConfig()).run());
        case "jobs":
            process.exit(await runJobCommand(commandArgs));
        default:
            usage();
            process.exit(command ? 1 : 0);
    }
} catch (error) {
    console.error(red(`✗ ${error instanceof Error ? error.message : error}`));
    process.exit(1);
}
