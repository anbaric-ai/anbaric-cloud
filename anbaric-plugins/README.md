# anbaric-plugins

Open-source plugins for the Anbaric platform dashboard. A plugin registers
pages and widgets on the platform's root app: pages appear in the side nav,
widgets are React components rendered into a page's `<main>`.

This package ships the plugins the platform loads by default:

| Plugin module | What it registers |
| --- | --- |
| `anbaric-plugins/state-machines` | The `/` Dashboard page with the state machines and jobs overview |

## How plugins work

A plugin is a TypeScript module that exports a `plugin` object. The platform
server (`anbaric-cloud-hosting`) loads the modules named in the
`ANBARIC_PLUGINS` environment variable (comma-separated) at boot, compiles
each one into a browser bundle, and serves it to the dashboard, which renders
the components. The dashboard's own build is plugin-agnostic — installing a
plugin is configuration only:

```
npm install some-plugin-package
ANBARIC_PLUGINS=some-plugin-package,anbaric-plugins/state-machines
```

If `ANBARIC_PLUGINS` is unset the platform loads
`anbaric-plugins/state-machines`, so the Dashboard is there by default.
Setting the variable replaces the default list, so include it explicitly if
you still want the Dashboard.

## Writing a plugin

```tsx
import type { Plugin } from 'anbaric-cloud-hosting'
import { Card } from '@anbaric/design-system/components/Card'

function GreetingWidget({ fetchData }: { fetchData: (parameters?: Record<string, string>) => Promise<any> }) {
  return <Card>Hello from a plugin.</Card>
}

const plugin: Plugin = {
  name: 'greeting',
  pages: [{ path: '/greeting', title: 'Greeting', icon: 'waving_hand', navOrder: 50 }],
  widgets: [
    {
      page: '/greeting',
      id: 'greeting',
      component: GreetingWidget,
      data: async (parameters) => ({ greeted: parameters.name ?? 'world' }),
    },
  ],
}

export { plugin }
```

- **Pages** are registered by path; `/` is the homepage. Plugin page paths
  take precedence over deployed apps with the same name; `icon` is a
  Material Symbols name; lower `navOrder` sorts higher in the nav.
- **Widgets** attach to any page path — including pages registered by other
  plugins. `position` orders widgets on a page; a `title` renders a heading
  above the widget.
- **`data`** is an optional server-side function. The widget's component
  receives a `fetchData(parameters?)` prop that invokes it on the platform
  (`GET /plugins/data?plugin=<name>&widget=<id>&…`) and resolves with its
  JSON-serialisable return value. Because the function's code is also
  carried (unexecuted) in the browser bundle, do not import server-only
  modules at the top level of files that components also live in.
- Components render with the **platform's own React and design system**:
  imports of `react`, `react-dom` and `@anbaric/design-system/components/*`
  are provided by the dashboard at runtime, not bundled. Style with design
  system components and tokens; a plugin's own `.css` imports are ignored.
  The chart components (`Graph`, `ConcentrationCurve`, `ExposureBars`) are
  not available to plugins.

A package can ship several plugins by exposing one module per plugin via
`exports` subpaths, as this package does.

## Layout

One folder per plugin under `src/`, exported as a subpath:

```
src/state-machines/index.tsx        the plugin object
src/state-machines/StateMachinesWidget.tsx
```
