# anbaric-impl-cloud

The client library for a hosted Anbaric platform: HTTP implementations of
the [`anbaric-tsapi`](https://npmjs.com/package/anbaric-tsapi) contracts.
App code should not construct these directly — the factories in
`anbaric-state-machine` and `anbaric-data-store` select them automatically
when the platform injects the `cloud` environment.

All clients default their base URL to `ANBARIC_CLOUD_URL`. On a platform
this points at the platform's **internal entry point**, which serves only
the workflow APIs and is unreachable from outside the deployment's network.

| Class | Contract | Talks to |
| --- | --- | --- |
| `CloudJobPersistence` | `JobPersistence` | `/jobs` |
| `CloudQueue` | `Queue` | `/queue/enqueue`, `/queue/schedule` |
| `CloudJsonStore` | `JsonStore` | `/documents/<collection>` (validates against its schema client-side first) |
| `CloudSecretStore` | `SecretStore` | `/secrets` |
| `CloudConsumer` | `Consumer` | listens on `ANBARIC_CONSUMER_PORT` for `POST /process` pushes |

`CloudConsumer` is the push half of the platform's at-least-once delivery:
the platform's dispatcher POSTs `{ messages }` to the app's consumer URL,
the consumer responds `202` immediately, routes each message to its
workflow's subscriber, and confirms each successfully processed message back
via `POST /queue/confirm`. Unconfirmed messages are redelivered after the
platform's lease expires, so job processing must be idempotent.

Environment (all injected by the platform into deployed apps):
`ANBARIC_CLOUD_URL`, `ANBARIC_CONSUMER_PORT`, `ANBARIC_CONSUMER_URL` (how
the platform reaches the app back), plus the four `ANBARIC_*_TYPE=cloud`
factory switches.
