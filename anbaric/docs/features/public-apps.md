# Public apps

An app is private by default: only members of your tenant can open it, after
signing in. A **public app** can be opened by anyone with its address, without
signing in and without the `access` entitlement - a storefront, a booking page,
a form for your customers.

A builder turns it on per app on the console's **Manage apps** page. It costs
$100/£100 a month per public app, charged by the day it is public and never
covered by the free allowance. It takes effect within a few seconds and
restarts nothing.

## Who your app sees

A public app is reached by two kinds of visitor:

- **A member** of your tenant who is signed in. They arrive with their session,
  exactly as they would at a private app, so `hasEntitlement` and
  `Human.fromSession` work for them and your other entitlements still apply.
- **Anyone else** - a stranger, or someone signed in to Anbaric who belongs to
  a different tenant. They arrive with **no session at all**. The platform
  never hands your app a session it did not issue, so nobody's identity from
  elsewhere reaches your code.

Your app decides what an anonymous visitor may see and do. Check for a member
before anything that needs one:

```ts
import {Human, hasEntitlement} from "anbaric";

const visitorOf = async (request : IncomingMessage) : Promise<Human | undefined> => {
    try {
        return await Human.fromSession(request);
    } catch {
        return undefined;
    }
};

server.on("request", async (request, response) => {
    if (request.url === "/admin" && ! await hasEntitlement(request, "admin")) {
        response.writeHead(403).end("Members with the admin entitlement only");
        return;
    }
    const visitor = await visitorOf(request);
    ...
});
```

`hasEntitlement` answers `false` for an anonymous visitor rather than throwing;
`Human.fromSession` throws, which is why it is wrapped above. Anything an
anonymous visitor does - a job started from a form, say - should be attributed
to a `Code` actor of your own naming, such as `new Code("storefront")`.

## Letting members sign in

A member who is not signed in is treated as anonymous until they are. Give them
a link to `/login` on your app's own address:

```html
<a href="/login">Sign in</a>
```

It takes them through the sign-in and back to the page the link was on - read
from the browser's Referer, and only trusted when that page is on your app's
own address; otherwise they land on your app's home page. Someone already signed
in goes straight back. An app served under `/app/<name>` rather than its own
address can link to `/login` the same way.

Prefer serving a public app at its own address (see
[Serving a web UI](serving-a-web-ui.md)). Under `/app/<name>`, an absolute link
such as `/styles.css` falls outside the app and is not public.

## Next

- [Entitlements](entitlements.md) - what a member has been granted
- [Authorization with actors and roles](../patterns/authorization.md)
