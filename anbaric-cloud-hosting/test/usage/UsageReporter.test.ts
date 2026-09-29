import {afterEach, describe, expect, it, vi} from "vitest";
import {UsageReporter} from "../../src/usage/UsageReporter";

const ok = async (_url : string, _init : RequestInit) => ({ ok: true, status: 200 }) as Response;

describe("UsageReporter", () => {

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("tells central how many apps this tenant is running, with its key", async () => {
        const fetchFn = vi.fn(ok);

        await new UsageReporter("https://central.example", "central-secret", "acme", () => 4, fetchFn).report();

        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe("https://central.example/usage");
        expect((init.headers as Record<string, string>)["x-anbaric-central-key"]).toBe("central-secret");
        const body = JSON.parse(init.body as string);
        expect(body).toMatchObject({ slug: "acme", apps: 4 });
        expect(body.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("counts again on every report rather than remembering the first", async () => {
        const fetchFn = vi.fn(ok);
        let apps = 1;
        const reporter = new UsageReporter("https://central.example", "s", "acme", () => apps, fetchFn);

        await reporter.report();
        apps = 6;
        await reporter.report();

        expect(fetchFn.mock.calls.map(call => JSON.parse(call[1].body as string).apps)).toEqual([1, 6]);
    });

    it("reports on its interval until stopped", async () => {
        vi.useFakeTimers();
        const fetchFn = vi.fn(ok);
        const reporter = new UsageReporter("https://central.example", "s", "acme", () => 1, fetchFn, 1_000);

        reporter.start();
        await vi.advanceTimersByTimeAsync(3_000);
        expect(fetchFn).toHaveBeenCalledTimes(4);

        await reporter.cleanUp();
        await vi.advanceTimersByTimeAsync(3_000);
        expect(fetchFn).toHaveBeenCalledTimes(4);
    });

    /* Billing must never be able to take the platform down, and a lost hour
       costs nothing: the day is the highest count that reached central. */
    it("survives central being unreachable", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) : Promise<Response> => { throw new Error("connect ECONNREFUSED"); });

        expect(await new UsageReporter("https://central.example", "s", "acme", () => 1, fetchFn).report()).toBe(false);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("could not report the app count"));
    });

    it("survives central refusing the report", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) => ({ ok: false, status: 401 }) as Response);

        expect(await new UsageReporter("https://central.example", "s", "acme", () => 1, fetchFn).report()).toBe(false);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("401"));
    });

});
