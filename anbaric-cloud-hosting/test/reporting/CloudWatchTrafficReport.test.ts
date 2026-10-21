import {describe, expect, it, vi} from "vitest";
import {GetQueryResultsCommand, StartQueryCommand} from "@aws-sdk/client-cloudwatch-logs";
import {CloudWatchTrafficReport} from "../../src/reporting/CloudWatchTrafficReport";

const NOW = Date.parse("2026-10-21T13:25:00Z");

const row = (app : string, hour : string, pageviews : number, sessions : number) => [
    { field: "app", value: app },
    { field: "hour", value: hour },
    { field: "pageviews", value: String(pageviews) },
    { field: "sessions", value: String(sessions) },
];

const logsAnswering = (...statuses : Array<{ status : string, results? : Array<any> }>) => {
    const answers = [...statuses];
    return {
        send: vi.fn(async (command : any) => command instanceof StartQueryCommand ? { queryId: "q-1" } : answers.shift()),
    };
};

const reportOver = (logs : { send : (command : any) => Promise<any> }, logGroup : string | undefined = "/anbaric/acme/platform") =>
    new CloudWatchTrafficReport(async () => logGroup, logs, () => NOW, async () => {});

describe("CloudWatchTrafficReport", () => {

    it("queries the platform's log for pageviews over whole hours", async () => {
        const logs = logsAnswering({ status: "Complete", results: [] });

        await reportOver(logs).hourly(3);

        const start = logs.send.mock.calls[0][0] as StartQueryCommand;
        expect(start.input.logGroupName).toBe("/anbaric/acme/platform");
        expect(start.input.startTime).toBe(Date.parse("2026-10-21T11:00:00Z") / 1000);
        expect(start.input.endTime).toBe(NOW / 1000);
        expect(start.input.queryString).toContain(`filter anbaric = "pageview"`);
        expect(start.input.queryString).toContain("count_distinct(visitor) as sessions by app, bin(1h)");
    });

    it("waits for the query to finish and answers each app's hours", async () => {
        const logs = logsAnswering(
            { status: "Running" },
            { status: "Complete", results: [row("shop", "2026-10-21 12:00:00.000", 40, 7), row("crm", "2026-10-21 13:00:00.000", 3, 1)] });

        const hours = await reportOver(logs).hourly(2);

        expect(hours).toEqual([
            { app: "shop", hour: "2026-10-21T12:00:00.000Z", pageviews: 40, sessions: 7 },
            { app: "crm", hour: "2026-10-21T13:00:00.000Z", pageviews: 3, sessions: 1 },
        ]);
        expect(logs.send.mock.calls.filter(([command]) => command instanceof GetQueryResultsCommand)).toHaveLength(2);
    });

    it("says so when the query fails", async () => {
        await expect(reportOver(logsAnswering({ status: "Failed" })).hourly(2)).rejects.toThrow(`The traffic query ended as "Failed"`);
    });

    it("refuses when it cannot tell which log to read, and asks again next time", async () => {
        let logGroup : string | undefined;
        const logs = logsAnswering({ status: "Complete", results: [] });
        const report = new CloudWatchTrafficReport(async () => logGroup, logs, () => NOW, async () => {});

        await expect(report.hourly(2)).rejects.toThrow("This platform cannot tell which log its traffic is written to");
        logGroup = "/anbaric/acme/platform";
        await expect(report.hourly(2)).resolves.toEqual([]);
    });

});
