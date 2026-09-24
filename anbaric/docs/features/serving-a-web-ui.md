# Serving a web UI

An Anbaric app can serve its own HTTP frontend — a page, a form, an API — and
combine it with the state machine and stores to put your data on screen.

## Listen on `PORT`

Serve HTTP by listening on `process.env.PORT`. When deployed, the platform's app
proxy routes external traffic to your app; locally you just open the port.

```ts
import {createServer} from "node:http";

createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<h1>My Anbaric app</h1>");
}).listen(Number(process.env.PORT ?? 3000));
```

Serving HTTP is **optional** — a built-in admin process answers the platform's
liveness check on a separate port, so an app with no web server still deploys.

Serve trivial pages directly like this; build richer UIs with React and the
Anbaric design system (`anbaric-design-system`). `sample-apps/crm` is a complete
worked example.

## How the proxy routes to you

Deployed, your app is reached at **`<platform>/app/<name>/…`**. The proxy strips
the `/app/<name>` prefix before forwarding, so your app sees the sub-path:

```
browser →  https://cloud.anbaric.ai/app/crm/customers
your app ←  GET /customers
```

The query string is preserved, and cookies, `Set-Cookie` and `Location` headers
pass through untouched — so sessions and redirects from your HTML work normally.

## Absolute-path links

The proxy strips `/app/<name>`, so an **absolute-path** link or resource —
`href="/customers"`, `<link href="/styles.css">` — points at the platform root
rather than your app. The platform recovers these for you: a request for an
unrouted absolute path that arrives with a `Referer` from your app is redirected
back to `/app/<name>/…` (a `307`, so form POSTs keep their body). So ordinary
absolute links followed from a page of your app just work.

## Your app's own hostname

Every app also answers on a hostname of its own:

```
https://<app>--<tenant>.<platform domain>
```

There your app is at the root, exactly where it was when you ran it locally, so
absolute paths, `fetch("/api/…")` and anything else that assumes the root work
without being rewritten. This is the address to share and the one to prefer; the
`/app/<name>` form below stays available and unchanged.

The tenant is part of the name because two tenants may each have a `hello-world`.
A double hyphen separates the two, so an app name may not contain one, and the
app and tenant together must fit the 63 characters a hostname label allows. A
deploy that would break either rule is refused with the reason.

## Under /app/&lt;name&gt;

The exception is when the browser sends no `Referer` (for example under a strict
`Referrer-Policy: no-referrer`). For guaranteed correctness in that case, either:

1. **Use relative links** — `href="customers"`, `action="./submit"` — which
   resolve against the current path; or
2. **Rebuild absolute paths from the prefix.** The proxy sends an
   **`X-Forwarded-Prefix`** header (`/app/<name>`); prepend it when you must emit
   an absolute path:

   ```ts
   const prefix = request.headers["x-forwarded-prefix"] ?? "";
   const loginUrl = `${prefix}/login`;   // → /app/crm/login
   ```

## Knowing who's visiting

Turn the browser user's platform session into a `Human` actor so their actions
are attributed to them:

```ts
import {Human} from "anbaric";

const actor = await Human.fromSession(request);   // reads the anbaric_session cookie
await machine.updateJob(jobId, new Map([["approved", true]]), actor);
```

It throws if there's no valid session — wrap it and fall back to a login redirect
(remember the prefix caveat above). See [Actions and
actors](actions-and-actors.md#identifying-the-logged-in-person).

Sessions are long-lived (30 days, sliding), so users rarely re-authenticate
mid-session. If one does lapse, a form **POST** returns a `401` rather than a
login redirect — that's deliberate, so the submission fails cleanly instead of
losing its body. Have your page handle a `401` by reloading and resubmitting. See
[Web APIs → Sessions](../api/web.md#sessions).

## Next

- [Deploying](deploying.md) — ship the app
- [API: Web APIs](../api/web.md) — the proxy, headers and platform endpoints
- [Human-in-the-loop](../patterns/human-in-the-loop.md) — a UI that resolves an `Await`
