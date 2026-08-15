# anbaric-cloud-hosting-auth-auth0

Auth0 session authentication for the Anbaric platform. **Private and
unpublished by design** — deployments obtain it with the platform source;
it is loaded at boot via `ANBARIC_AUTHENTICATOR=anbaric-cloud-hosting-auth-auth0`.

Implements the platform's `Authenticator` contract with Auth0's
authorization-code flow: unauthenticated requests redirect to the tenant's
Auth0 login, `/callback` exchanges the code and sets the id_token as the
session cookie, and every request verifies the token against Auth0's JWKS
(issuer + client id audience). `authenticate` returns `[User, Tenant]` —
the user from `sub` and roles from the roles claim; the tenant from
`org_name`, falling back to `org_id`, falling back to the personal `sub`.

| Variable | Purpose |
| --- | --- |
| `ANBARIC_AUTH0_DOMAIN` | Auth0 tenant domain |
| `ANBARIC_AUTH0_CLIENT_ID` / `ANBARIC_AUTH0_CLIENT_SECRET` | the platform's Auth0 application |
| `ANBARIC_PLATFORM_PUBLIC_URL` | callback base; `<url>/callback` must be in the app's Allowed Callback URLs |
| `ANBARIC_AUTH0_ORGANIZATION` | optional org (id `org_…` or name slug): login redirects carry `organization=` so only members can log in, and sessions from any other org are rejected |
| `ANBARIC_AUTH0_ROLES_CLAIM` | roles claim (default `https://anbaric.ai/roles`) |

Organization invitation links from the Auth0 dashboard work end to end: the
authenticator forwards `invitation` and `organization` query parameters
through the login redirect, so an invited user lands in the right org and
their sessions carry it — which is also the tenant bound to any CLI key they
approve.
