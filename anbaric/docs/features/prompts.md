# Prompts

The instructions you give a model are part of your app, but they change more
often than code and you want to see what was said when. The **prompt manager**
keeps each prompt your app uses as a **versioned** record: save it at startup,
fetch it where you call the model, and every change is kept in the console with
its history. Like every other store, it's in-memory locally and platform-backed
once deployed - no code change.

## Register prompts at startup

Save each prompt once when the app starts. If nothing changed since the last
run, no new version is stored - so registering on every boot is free.

```ts
import {PromptManagerFactory} from "anbaric";

const prompts = PromptManagerFactory.instance();

await prompts.save(
    "triage",
    "Decide the priority of the support ticket from its subject and body. Escalate anything mentioning an outage.",
    { type: "object", required: ["subject", "body"], properties: { subject: { type: "string" }, body: { type: "string" } } },
    { type: "object", required: ["priority"], properties: { priority: { type: "string", enum: ["low", "high"] } } },
);
```

A prompt has an **id**, its **instructions**, and optionally an **input
schema** (the shape of what the model is given) and an **output schema** (what
it must produce). Edit the instructions and redeploy: the next save stores
version 2. There's no rollback and no tagging - an app always gets the latest.

## Use the latest where you call the model

```ts
import {OpenAIAgent, RemoteLLMAgenticAction} from "anbaric";

const triagePrompt = await prompts.retrieve("triage");

const triage = new RemoteLLMAgenticAction(
    "Triage the ticket",
    new OpenAIAgent("triager", "support", { apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5.4-mini" }),
    [{ role: "system", content: triagePrompt.instructions }],
    triagePrompt.outputSchema!,
);
```

`retrieve(id)` returns the latest version; `retrieve(id, 3)` a specific one.
An unknown prompt throws `No prompt found with id "..."`.

## Look back

```ts
const latest = await prompts.list();            // the latest version of every prompt this app has
const versions = await prompts.history("triage"); // every version, newest first
```

The console's **Prompts** page shows the same for every app on the tenant: each
prompt, its current instructions and schemas, and the full history to browse.

## Everything is scoped to your app

Deployed, prompts are **owned by your app** - two apps can both have a `triage`
prompt without seeing each other's. The platform scopes every read and write to
your app automatically.

## Choosing an implementation

You don't - the factory does, from the environment:

| Factory | Env var | Local default | Deployed |
| --- | --- | --- | --- |
| `PromptManagerFactory.instance()` | `ANBARIC_PROMPT_MANAGER_TYPE` | in-memory | platform (`cloud`) |

## Next

- [AI agents](ai-agents.md) - putting a prompt to work in a state
- [API: Stores](../api/stores.md#promptmanager)
