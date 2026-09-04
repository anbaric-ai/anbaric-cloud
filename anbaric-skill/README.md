# Anbaric for Claude Code

Build a working [Anbaric](https://anbaric.ai) application by asking for one.

```
/anbaric build me a CRM
```

Claude scaffolds a Node.js + TypeScript app that models your domain as Anbaric **state machines**,
runs it locally in memory — no account, no login, no cloud — and only then offers to deploy it to
Anbaric Cloud.

## Install

```
/plugin marketplace add anbaric-ai/anbaric-claude-plugin
/plugin install anbaric@anbaric
```

Then `/anbaric <what you want to build>`, or just describe an Anbaric app and the skill triggers
itself.

## What you get

- **`/anbaric`** — a command that takes a product description and builds the app.
- **The `anbaric` skill** — the programming model (states, actions, awaits, transitions, actors,
  jobs), the local-first workflow, and the platform's own conventions, so generated code looks like
  code the Anbaric team would write.
- **Reference docs** — the platform's full documentation, read on demand rather than dumped into
  context.
- **Project templates** — a minimal, runnable app skeleton, so scaffolding is copied rather than
  hallucinated.
- **An MCP server** — 13 tools over the Anbaric platform API (`anbaric_deploy`, `anbaric_jobs_list`,
  `anbaric_job_create`, `anbaric_app_logs`, …) for the cloud half of the workflow. It reuses the
  `anbaric` CLI's credentials from `~/.anbaric`, so if you're logged in there, you're logged in here.

## Local first

The point of the local-first flow is that **the same source runs unchanged in both places**. Anbaric
resolves its persistence, queue, document store and auditor through factories that read `ANBARIC_*`
environment variables. Locally there are none, so you get in-memory implementations and console
auditing. Deployed, the platform injects them and you get Postgres, durable queueing, the admin
console and a full audit trail — with no code change and no build step.

So you can build and verify an entire application before deciding whether you want an account.

## Requirements

- Claude Code
- Node.js 20+
- An Anbaric Cloud account — **only** when you choose to deploy

## Development

The skill's reference docs and the MCP's platform client are owned by the Anbaric platform
monorepo. To refresh them:

```bash
ANBARIC_MONOREPO=/path/to/monorepo npx tsx scripts/sync-from-monorepo.ts
(cd plugins/anbaric/mcp && npm install && npm run bundle)
```

`plugins/anbaric/mcp/dist/index.js` is committed on purpose: the plugin has to run straight from a
clone, with no build step for the person installing it.

Validate the marketplace and plugin manifests before publishing:

```bash
claude plugin validate .
```

## Licence

MIT
