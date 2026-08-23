import {IncomingMessage} from "node:http";

const SESSION_COOKIE = "anbaric_session";

/* Reads the anbaric_session cookie value from an incoming request (or a raw
   Cookie header string). Returns undefined when the cookie is absent. */
const sessionCookie = (source : IncomingMessage | string) : string | undefined => {
    const header = typeof source === "string" ? source : String(source.headers.cookie ?? "");
    for (const cookie of header.split(";")) {
        const [name, ...value] = cookie.trim().split("=");
        if (name === SESSION_COOKIE) return value.join("=");
    }
    return undefined;
};

export { sessionCookie, SESSION_COOKIE }
