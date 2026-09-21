# Entitlements

Roles say what kind of user someone is. **Entitlements** say what a particular
user has been given: access to a beta feature, an export capability, a paid
tier. Your app declares the entitlements it cares about and asks whether the
signed-in user holds one; administrators hand them out from the console.

## Declare what you check

Register each entitlement once, at startup. That makes it visible in the
console so it can be granted, and gives it a note explaining what it unlocks.

```ts
import {registerEntitlement} from "anbaric";

await registerEntitlement("export", "Can export reports as CSV");
await registerEntitlement("beta", "Sees features still in preview");
```

Registration is idempotent and scoped to your app - `export` in your app is a
different entitlement from `export` in another.

## Check the signed-in user

`hasEntitlement` takes the incoming request (it reads the `anbaric_session`
cookie, exactly as `Human.fromSession` does) or a raw session token, resolves
the user, and answers for **your app**:

```ts
import {hasEntitlement} from "anbaric";

server.on("request", async (request, response) => {
    if (request.url === "/export") {
        if (! await hasEntitlement(request, "export")) {
            response.writeHead(403).end("You don't have the export entitlement");
            return;
        }
        ...
    }
});
```

A request with no session, or one the platform can't resolve, is simply not
entitled - `hasEntitlement` returns `false` rather than throwing.

## Global entitlements

Some entitlements aren't about one app. A **global entitlement** belongs to no
app and is created in the console, never by `registerEntitlement`. Every tenant
starts with one, `access`.

A grant can be scoped too. Granting a user `access` **for your app** and
granting them `access` **globally** both make `hasEntitlement(request, "access")`
return `true` in your app; only the global grant also satisfies every other app.

| Definition | Grant | `hasEntitlement(request, "access")` in `my-app` |
| --- | --- | --- |
| global `access` | `my-app` / `access` | true |
| global `access` | global / `access` | true (and in every other app) |
| global `access` | `other-app` / `access` | false |

## Granting

Apps can't grant. An administrator opens **Entitlements** in the console, picks
the user, the entitlement and its scope, and adds a note; the same page revokes
grants and creates global entitlements. Every grant records who made it.

## Locally

There's no console on your laptop, so the local implementation is
**permissive**: `hasEntitlement` always returns `true`. Your code paths run
unchanged; deployed, the platform answers for real. As with every other
service, the switch is the environment (`ANBARIC_ENTITLEMENTS_TYPE`), set by the
platform - don't set it yourself.

## Next

- [Authorization with actors and roles](../patterns/authorization.md) - roles, predicates and attribution
- [Environment and factories](../api/environment.md)
