import {describe, expect, it} from "vitest";
import {IncomingMessage, ServerResponse} from "node:http";
import {User} from "../../src/auth/User";
import {Request} from "../../src/hosting/Request";
import {LoggedTrafficRecorder} from "../../src/reporting/LoggedTrafficRecorder";

const requestFrom = (address : string, userAgent : string = "Firefox", user? : User) => {
    const request = new Request({ url: "/", method: "GET", headers: { "x-forwarded-for": `${address}, 10.0.0.1`, "user-agent": userAgent } } as unknown as IncomingMessage, {} as ServerResponse);
    request.user = user;
    return request;
};

const recorderOn = (day : string, lines : Array<any>) =>
    new LoggedTrafficRecorder("the-secret", line => lines.push(JSON.parse(line)), () => new Date(`${day}T12:00:00Z`));

describe("LoggedTrafficRecorder", () => {

    it("writes one line per pageview, naming the app and a visitor", () => {
        const lines : Array<any> = [];
        recorderOn("2026-10-21", lines).pageview(requestFrom("81.2.69.160"), "shop");

        expect(lines).toEqual([{ anbaric: "pageview", app: "shop", visitor: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/) }]);
    });

    it("never writes the address, the browser or the user id", () => {
        const written : Array<string> = [];
        const recorder = new LoggedTrafficRecorder("the-secret", line => written.push(line));

        recorder.pageview(requestFrom("81.2.69.160", "Firefox"), "shop");
        recorder.pageview(requestFrom("81.2.69.160", "Firefox", new User("auth0|chris")), "shop");

        expect(written.join("\n")).not.toMatch(/81\.2\.69\.160|Firefox|chris/);
    });

    it("sees the same visitor on the same app on the same day as one", () => {
        const lines : Array<any> = [];
        const recorder = recorderOn("2026-10-21", lines);

        recorder.pageview(requestFrom("81.2.69.160"), "shop");
        recorder.pageview(requestFrom("81.2.69.160"), "shop");
        recorder.pageview(requestFrom("81.2.69.161"), "shop");

        expect(lines[0].visitor).toBe(lines[1].visitor);
        expect(lines[2].visitor).not.toBe(lines[0].visitor);
    });

    it("cannot follow a visitor from one day, or one app, to the next", () => {
        const lines : Array<any> = [];
        recorderOn("2026-10-21", lines).pageview(requestFrom("81.2.69.160"), "shop");
        recorderOn("2026-10-22", lines).pageview(requestFrom("81.2.69.160"), "shop");
        recorderOn("2026-10-22", lines).pageview(requestFrom("81.2.69.160"), "crm");

        expect(new Set(lines.map(line => line.visitor)).size).toBe(3);
    });

    it("knows someone signed in by who they are, wherever they connect from", () => {
        const lines : Array<any> = [];
        const recorder = recorderOn("2026-10-21", lines);

        recorder.pageview(requestFrom("81.2.69.160", "Firefox", new User("auth0|chris")), "shop");
        recorder.pageview(requestFrom("10.9.8.7", "Safari", new User("auth0|chris")), "shop");

        expect(lines[0].visitor).toBe(lines[1].visitor);
    });

});
