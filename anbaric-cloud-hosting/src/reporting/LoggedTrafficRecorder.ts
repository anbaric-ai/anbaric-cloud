import {createHmac} from "node:crypto";
import {Request} from "../hosting/Request";
import {TrafficRecorder} from "./TrafficRecorder";

type WriteLine = (line : string) => void;

/* What marks a log line as a pageview, for whatever reads the log back. */
const PAGEVIEW = "pageview";

const writeToStandardOut : WriteLine = line => void process.stdout.write(`${line}\n`);

/* The address the person connected from: the first hop the edge recorded,
   since the platform itself only ever sees the load balancer. */
const clientAddress = (request : Request) : string =>
    request.header("x-forwarded-for")?.split(",")[0]?.trim() || request.raw.socket?.remoteAddress || "";

/* Records each pageview as one line of the platform's log, which the host
   keeps for as long as its retention says and no longer, so there is nothing
   to store or clear up here.

   A visitor is told apart without a cookie and without keeping who they are:
   someone signed in by their user id, anyone else by their address and
   browser, either way mixed with the app and the day under a key only the
   platform holds, and only the digest written. The same person on the same
   app on the same day is the same visitor; tomorrow they are someone new,
   and no line can be traced back to a person or followed across apps. */
class LoggedTrafficRecorder implements TrafficRecorder {

    constructor(private secret : string,
                private write : WriteLine = writeToStandardOut,
                private now : () => Date = () => new Date()) {}

    pageview(request : Request, appName : string) : void {
        const day = this.now().toISOString().slice(0, 10);
        const person = request.user
            ? `user ${request.user.id}`
            : `visitor ${clientAddress(request)} ${request.header("user-agent") ?? ""}`;
        const visitor = createHmac("sha256", this.secret).update(`${day}\n${appName}\n${person}`).digest("base64url").slice(0, 22);

        this.write(JSON.stringify({ anbaric: PAGEVIEW, app: appName, visitor }));
    }

}

export { LoggedTrafficRecorder, PAGEVIEW }
