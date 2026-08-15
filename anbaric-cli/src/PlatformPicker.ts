import {DEFAULT_PLATFORM_URL, productionUrlFor, stagingUrlFor} from "./CliConfig";
import {dim, green} from "./ui/Ansi";
import {select} from "./ui/Select";

const PING_TIMEOUT_MS = 1500;

const ping = async (url : string) : Promise<boolean> => {
    try {
        const response = await fetch(`${url}/ping`, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
        return response.ok;
    } catch {
        return false;
    }
};

const statusDot = (connected : boolean) => connected ? green("● connected") : dim("○ unreachable");

const choosePlatformUrl = async (tenant : string) : Promise<string> => {
    const environments = [
        { label: `Local Dev ${dim(`(${DEFAULT_PLATFORM_URL})`)}`, value: DEFAULT_PLATFORM_URL },
        { label: `Staging ${dim(`(${stagingUrlFor(tenant)})`)}`, value: stagingUrlFor(tenant) },
        { label: `Production ${dim(`(${productionUrlFor(tenant)})`)}`, value: productionUrlFor(tenant) },
    ];
    const connected = await Promise.all(environments.map(environment => ping(environment.value)));

    return select(`Which platform do you want to use for tenant ${tenant}?`, environments.map((environment, index) => ({
        ...environment,
        hint: statusDot(connected[index]),
    })));
};

export { choosePlatformUrl };
