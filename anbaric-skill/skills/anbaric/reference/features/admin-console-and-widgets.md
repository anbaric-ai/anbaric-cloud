# The admin console and widgets

Every platform serves an **admin console** at its root — a dashboard for watching
your state machines, jobs, queue and audit trail. It's assembled from
**plugins**, so it can be extended with your own pages and widgets.

## The built-in dashboard

Out of the box the console lists your state machines and their jobs, shows counts
per state and queue depth, and (with the cloud plugins) surfaces things like jobs
currently **awaiting input** — with a clickable link to each human task's
`resolveUrl` (see [Awaiting input](awaiting-input.md)). Audit records are
browsable here too.

For most apps you simply *use* the console — deploy, then open the platform URL
and watch your jobs move.

## Extending it with plugins

The console is built from plugins named in the platform's `ANBARIC_PLUGINS`
setting. A plugin is a small module that exports **pages** and **widgets**:

```ts
import type { Plugin } from 'anbaric-cloud-hosting';

const plugin: Plugin = {
  name: 'reports',
  pages: [{ path: '/reports', title: 'Reports', icon: 'insights', navOrder: 5 }],
  widgets: [
    { page: '/reports', id: 'weekly', position: 1, component: WeeklyReport, data: weeklyData },
  ],
};

export { plugin };
```

- A **page** registers a route (`path`), a nav `title`, an optional Material
  Symbols `icon`, and `navOrder`.
- A **widget** attaches a React `component` to any page (`page` + `id` +
  `position`), optionally backed by a server-side `data` function.

### Server-side data

A widget's `data(parameters)` function runs **on the platform**, where it can
query the platform database directly. The component receives a `fetchData` prop
that calls it over HTTP and hands back the result:

```tsx
function WeeklyReport({ fetchData }: { fetchData: (p?: Record<string, string>) => Promise<any> }) {
  const { data } = useServerData(fetchData);   // calls fetchData() on mount
  return <Card>…</Card>;
}
```

Widgets render with the platform's own React and the Anbaric **design system**
(`@anbaric/design-system`) — use its components and tokens rather than
hardcoding styles.

> **Author's caveat.** The data function's code is also carried (unexecuted) into
> the browser bundle, so don't import server-only modules (like `pg`) at the top
> level of a file that also defines a component. Keep data functions and
> components in separate files, or import server modules only inside the data
> function.

## Turning plugins on

`ANBARIC_PLUGINS` is a comma-separated list of plugin modules. Setting it
**replaces** the default, so include the built-in dashboard (or a plugin that
registers `/`) alongside your own:

```
ANBARIC_PLUGINS=anbaric-plugins/state-machines,my-reports-plugin
```

Plugins are a **platform-level** capability: you configure them when you run your
own platform (see [Deploying → running your own platform](deploying.md)), or when
your Anbaric Cloud tenant is set up. A plain `anbaric app deploy` deploys an
*app*, not a plugin.

## Next

- [API: Web APIs](../api/web.md) — the plugin data endpoints
- [Auditing](auditing.md) — what the console shows
