import {CloudWatchLogsClient, GetQueryResultsCommand, StartQueryCommand} from "@aws-sdk/client-cloudwatch-logs";
import {PAGEVIEW} from "./LoggedTrafficRecorder";
import {TrafficHour, TrafficReport} from "./TrafficReport";

type LogsClient = { send(command : any) : Promise<any> };
type LogGroupName = () => Promise<string | undefined>;
type Sleep = (ms : number) => Promise<void>;

const HOUR_MS = 3_600_000;
const POLL_MS = 500;
const QUERY_TIMEOUT_MS = 30_000;
const MOST_ROWS = 10_000;

const QUERY = `filter anbaric = "${PAGEVIEW}"
| stats count(*) as pageviews, count_distinct(visitor) as sessions by app, bin(1h) as hour
| sort hour asc`;

/* On ECS a container can ask where its own logs go, so the platform needs
   no setting to find them. Anywhere else there is no answer. */
const logGroupFromTaskMetadata : LogGroupName = async () => {
    const metadataUri = process.env.ECS_CONTAINER_METADATA_URI_V4;
    if (! metadataUri) return undefined;

    const container = await (await fetch(metadataUri)).json() as { LogOptions? : Record<string, string> };
    return container.LogOptions?.["awslogs-group"];
};

// Insights writes a bin as "2026-10-21 13:00:00.000", in UTC.
const isoHour = (bin : string) : string => new Date(`${bin.replace(" ", "T")}Z`).toISOString();

/* Traffic read back from the platform's own CloudWatch log with a Logs
   Insights query. Its distinct count is an estimate, which is all a visitor
   count needs; its history is the log group's retention. */
class CloudWatchTrafficReport implements TrafficReport {

    private logGroupName? : Promise<string | undefined>;

    constructor(private logGroup : LogGroupName = logGroupFromTaskMetadata,
                private logs : LogsClient = new CloudWatchLogsClient({}),
                private now : () => number = Date.now,
                private sleep : Sleep = ms => new Promise(resolve => setTimeout(resolve, ms))) {}

    async hourly(hours : number) : Promise<Array<TrafficHour>> {
        this.logGroupName ??= this.logGroup().catch(() => undefined);
        const logGroupName = await this.logGroupName;
        if (! logGroupName) {
            this.logGroupName = undefined;
            throw new Error("This platform cannot tell which log its traffic is written to");
        }

        const end = this.now();
        const start = Math.floor(end / HOUR_MS) * HOUR_MS - (hours - 1) * HOUR_MS;
        const { queryId } = await this.logs.send(new StartQueryCommand({
            logGroupName,
            startTime: Math.floor(start / 1000),
            endTime: Math.ceil(end / 1000),
            queryString: QUERY,
            limit: MOST_ROWS,
        }));

        return this.resultsOf(queryId);
    }

    private async resultsOf(queryId : string) : Promise<Array<TrafficHour>> {
        const deadline = this.now() + QUERY_TIMEOUT_MS;
        while (this.now() < deadline) {
            const response = await this.logs.send(new GetQueryResultsCommand({ queryId }));
            if (response.status === "Complete") return (response.results ?? []).map((row : Array<{ field? : string, value? : string }>) => this.hourFrom(row));
            if (response.status !== "Running" && response.status !== "Scheduled") {
                throw new Error(`The traffic query ended as "${response.status}"`);
            }
            await this.sleep(POLL_MS);
        }
        throw new Error(`The traffic query took longer than ${QUERY_TIMEOUT_MS / 1000}s`);
    }

    private hourFrom(row : Array<{ field? : string, value? : string }>) : TrafficHour {
        const fields = new Map(row.map(cell => [cell.field, cell.value ?? ""]));
        return {
            app: fields.get("app") ?? "",
            hour: isoHour(fields.get("hour") ?? ""),
            pageviews: Number(fields.get("pageviews") ?? 0),
            sessions: Number(fields.get("sessions") ?? 0),
        };
    }

}

export { CloudWatchTrafficReport }
