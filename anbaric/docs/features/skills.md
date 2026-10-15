# Skills

An agent building on your tenant learns the platform from these docs, which
are the same for everyone. What they cannot tell it is what *your* tenant has:
a service you run, a convention your team follows, an internal system an app
should call a certain way. A **skill** is how you tell it. It is a short piece
of guidance a builder writes once, in the console, and every agent working on
the tenant through the Anbaric MCP sees from then on.

## What a skill is

A skill has four parts:

| Field | What it is for |
|---|---|
| **id** | A short slug (lower-case letters, digits and hyphens, up to 50 characters). It becomes part of the tool's name. |
| **title** | How the skill is named to people and to the agent. |
| **usage hints** | *When* an agent should reach for it. This is what the agent reads before deciding, so say what task or situation the skill applies to. |
| **body** | *What* to do: the instructions themselves. The agent reads this only once it has decided the skill applies. |

Keep the hints short and specific - "Read before fetching an external web page
or file from an app" - and put the detail in the body: endpoints, headers,
examples, the mistakes to avoid.

## Where skills live

The **Skills** page in the console lists the tenant's skills and lets a builder
(owner, admin or builder role) add, edit and remove them. Anyone in the tenant
can read them. Skills belong to the tenant, not to an app, and deployed apps
cannot see them: they are for the people and agents working on the tenant, not
for its runtime.

A skill marked **Managed service** is written by Anbaric for a service your
tenant has, such as the additional services, and kept current by us. It is
offered to your agents like any other but is not yours to edit or remove.

## How an agent sees them

Each skill is offered to the agent as a tool named `anbaric_skill_<id>` (hyphens
in the id become underscores), whose description is the skill's title and usage
hints. That is all the agent sees up front, which is how it decides relevance
without reading everything. Calling the tool returns the body. A skill added or
changed in the console appears the next time the agent's tools are listed,
and straight after `anbaric_login`.

Skills are not a replacement for these docs; they are the layer on top that is
yours. An agent is told to read the skills whose hints match its task before
building, and to prefer what they say where the two differ.
