# API — Web APIs

What you need when your app serves HTTP or talks to the platform over the web:
how the app proxy behaves, and the platform endpoints an app author calls.

## Serving HTTP from your app

- **Listen on `process.env.PORT`.** The platform injects it (it is the
  `internalPort` from your `.anbaric/app-config.json`); default to `3000` locally.
- **Optional.** A built-in admin process answers the platform's liveness check on
  a separate port, so an app with no HTTP server still deploys.

## The app proxy

Deployed, external traffic reaches your app through the platform's reverse proxy.

| Aspect | Behaviour |
| --- | --- |
| Public path | `<platform>/app/<name>/…` |
| Forwarded path | the `/app/<name>` prefix is **stripped** — your app sees the sub-path (e.g. `/customers`) |
| Query string | preserved |
| `Cookie` / `Set-Cookie` / `Location` | passed through untouched (sessions and redirects work) |
| Only running apps | requests to a non-running app return `404` |

### Headers the proxy adds

| Header | Value |
| --- | --- |
| `X-Forwarded-Prefix` | `/app/<name>` — prepend to reconstruct absolute public paths |
| `X-Forwarded-Host` | the original `Host` |
| `X-Forwarded-Proto` | `https` |

**Absolute-path links** (a sub-page like `/orders`, or a resource like
`/styles.css`) point at the platform root rather than your app, because the proxy
strips the `/app/<name>` prefix. The platform recovers these automatically: when
a request for an unrouted absolute path arrives with a `Referer` from your app,
it's redirected (`307`, so form POSTs keep their method and body) back to
`/app/<name>/…`. So an ordinary `<a href="/orders">` or `<link href="/styles.css">`
followed from an app page just works. The redirect is `Referer`-dependent, so
it's sent `Cache-Control: no-store` and `Vary: Referer` — the same root path can
belong to different apps, and must never be cached and served cross-app.

The one gap is the `Referer`: a browser that sends none (e.g. under a strict
`Referrer-Policy: no-referrer`) can't be recovered. For guaranteed correctness,
prefer **relative** links, or build absolute paths from `X-Forwarded-Prefix`:

```ts
const prefix = request.headers["x-forwarded-prefix"] ?? "";
response.writeHead(302, { Location: `${prefix}/login` });
```

## Platform endpoints

The platform API lives under **`/api/v2`**. Most of the time you use it
indirectly — the `anbaric` factories and cloud clients call it for you (jobs,
stores, auditing). The endpoints an app author touches directly:

### Sessions

Used by [`Human.fromSession`](actors-and-agents.md#human) to identify the browser
user. An app can't verify the session cookie itself (the signing secret is
platform-only), so it asks the platform:

```
POST /api/v2/sessions/resolve
Content-Type: application/json

{ "session": "<anbaric_session cookie value>" }
```

```jsonc
// 200 OK
{ "id": "user-123", "roles": ["admin"], "tenant": "acme" }
// 401 — invalid or expired
{ "error": "Invalid or expired session" }
```

You normally never call this directly — `Human.fromSession(request)` does.

**Session lifetime.** Once a user has signed in, the platform holds a long-lived
signed session (30 days by default, sliding — its expiry is refreshed on every
request), so users aren't bounced to the identity provider mid-session. If a
session *has* lapsed, a **state-changing** request (`POST`/`PUT`/`PATCH`/`DELETE`)
to your app is answered with **`401`** rather than a login redirect — so a form
submission fails cleanly instead of silently losing its body. Handle a `401` by
reloading (a `GET`, which re-authenticates) and resubmitting. Plain page
navigations (`GET`) still redirect to login as usual.

### Who am I

```
GET /api/v2/whoami   →   { "id": "user-123", "roles": ["admin"] }
```

Returns the authenticated user for the current request.

### Other resources

Also under `/api/v2`, reached through the cloud clients rather than raw HTTP:
`jobs`, `state-machines`, `queue`, `consumers`, and (when enabled) `documents`,
`secrets`, `audits`. Prefer the typed clients and factories over calling these by
hand.

## Plugin data endpoints

If you build an admin-console [plugin](../features/admin-console-and-widgets.md),
its widgets fetch server-side data through:

```
GET /api/v2/plugins/data?plugin=<name>&widget=<id>&<your params…>
```

Extra query parameters become the `parameters` argument of the widget's `data`
function. The widget component receives a `fetchData(parameters?)` prop that calls
this for you. (`GET /api/v2/plugins` returns the manifest and
`/api/v2/plugins/<name>.js` the browser bundle — the console uses these; you
don't call them directly.)

## See also

- [Serving a web UI](../features/serving-a-web-ui.md)
- [Deploying](../features/deploying.md)
- [CLI reference](cli.md)
