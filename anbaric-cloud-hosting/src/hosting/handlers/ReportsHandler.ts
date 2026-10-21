import {deniesBuild} from "../../auth/TenantRole";
import {TrafficHour, TrafficReport} from "../../reporting/TrafficReport";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

const DEFAULT_HOURS = 48;
const MOST_HOURS = 30 * 24;
const REMEMBERED_MS = 60_000;

/* Reports on the tenant's apps for its builders: GET /api/v2/reports/traffic
   answers each app's pageviews and visitors per hour over the last `hours`
   (48 unless asked, at most 30 days). Reading traffic back is slow, so an
   answer is kept for a minute and the console's refreshes cost nothing. A
   platform that keeps no traffic says so, and one that cannot read it right
   now says why. */
class ReportsHandler implements RequestHandler {

    private remembered = new Map<number, { at : number, hours : Promise<Array<TrafficHour>> }>();

    constructor(private traffic? : TrafficReport, private now : () => number = Date.now) {}

    async handle(request : Request) : Promise<void> {
        if (request.method !== "GET" || request.id !== "traffic" || request.subresource) return request.notFound();
        if (deniesBuild(request.user?.tenantRole)) return request.reply(403, { error: "Your role in this tenant cannot see reports" });
        if (! this.traffic) return request.reply(409, { error: "This platform does not keep traffic reports" });

        const hours = Number(request.query("hours") ?? DEFAULT_HOURS);
        if (! Number.isInteger(hours) || hours < 1 || hours > MOST_HOURS) {
            return request.reply(400, { error: `"hours" must be a whole number from 1 to ${MOST_HOURS}` });
        }

        try {
            return request.reply(200, { hours, traffic: await this.hourly(this.traffic, hours) });
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            console.warn(`[reports] could not read traffic: ${reason}`);
            return request.reply(503, { error: `Traffic cannot be read right now: ${reason}` });
        }
    }

    private hourly(traffic : TrafficReport, hours : number) : Promise<Array<TrafficHour>> {
        const kept = this.remembered.get(hours);
        if (kept && this.now() - kept.at < REMEMBERED_MS) return kept.hours;

        const answer = traffic.hourly(hours);
        this.remembered.set(hours, { at: this.now(), hours: answer });
        answer.catch(() => {
            if (this.remembered.get(hours)?.hours === answer) this.remembered.delete(hours);
        });
        return answer;
    }

}

export { ReportsHandler }
