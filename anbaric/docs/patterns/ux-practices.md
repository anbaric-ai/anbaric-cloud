# UX practices for Anbaric apps

Anbaric apps are asynchronous by nature: submitting a form doesn't finish the
work, it hands a job to a state machine that then moves on its own. A UI that
ignores that feels broken even when everything is working. These are the
practices to follow when you build a human-facing interface on Anbaric.

## Acknowledge a submission immediately

**Always give feedback the moment a job update is submitted.** `updateJob` and
`startJob` return once the change is *stored and queued* — not once the job has
progressed. If the page sits silent, the person cannot tell whether their click
registered, and will click again.

Say what happened and what is happening next:

```
✓ Approval submitted — the job is being processed…
```

Disable the button while the request is in flight so the same update can't be
sent twice.

## Then follow the job until it settles

After acknowledging, watch the job so the page reflects reality rather than a
guess. Poll it and re-render as the state changes:

- **Poll at most once per second.** Anything faster adds load without telling
  the user anything new; a job that transitions immediately is still only
  observable per processing pass.
- **Stop when there is nothing left to wait for** — the job reached a terminal
  state, parked on an `Await`, or failed. Don't poll a settled job forever.
- **Show the state, not just a spinner.** "Awaiting approval", "Charging card",
  "Failed — card declined" tells someone far more than an endless whirl.
- **Back off or stop after a reasonable period**, and say so, rather than
  spinning indefinitely if nothing changes.

A job that has parked on an `Await` is waiting for a *person*, possibly not the
one at the screen. Say what it is waiting for rather than implying the page is
still loading.

## Surface failures honestly

A job whose action threw is `Job.Status.FAILED`, with the reason in its audit
trail. Show that the work stopped and why. Silently leaving the last-known state
on screen turns a failure into a mystery.

## Styling (optional)

If the user hasn't asked for a particular look, you may use the **Anbaric design
system** — design tokens, brand assets and React components:
<https://github.com/anbaric-ai/anbaric-cloud/tree/main/anbaric-design-system>.
It isn't published to npm, so copy in `tokens.css` and the components you need
rather than adding a dependency. If the user asked for something specific —
Tailwind, MUI, plain CSS, their own kit — use that instead; their choice wins.

## See also

- [Awaiting input](../features/awaiting-input.md) — pausing a job for a human
- [Human-in-the-loop](human-in-the-loop.md) — approvals, forms and hand-offs
- [Serving a web UI](../features/serving-a-web-ui.md) — putting data on a page
