# Anbaric Design System

`@anbaric/design-system` — the shared visual foundation for Anbaric products
(the portal and hosted apps). It provides global design tokens (colour,
gradients, typography, spacing, radius), brand assets, and a set of React
components, previewed through a Vite-powered living style guide. Colours and
type come from the Anbaric brand book (`anbaric-v2.pdf`, in this folder).

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the Vite preview / living style guide
```

Then open the printed local URL (Vite's default is http://localhost:5173). The
preview serves `index.html`: the token-reference sections plus the live,
interactive React components.

Other scripts:

- `npm run build` — bundle the preview into `dist/`.
- `npm run preview` — serve the built preview locally.

> `npm run build` produces a **self-contained** `dist/index.html` — every
> script, style and image inlined — so the built guide opens straight from the
> filesystem (double-click, `file://`), no server needed. The components stay
> real React; only the packaging is flattened. During development, `npm run
> dev` gives hot reload as usual.

---

## Structure

```
design-system/
├── package.json        # @anbaric/design-system — name, ESM, exports map
├── tokens.css          # all design tokens as CSS custom properties (:root)
├── index.html          # living style guide / preview of every token
├── README.md           # this file
├── shared/             # cross-cutting shared resources
│   └── assets/
│       ├── anbaric-logo.png    # the logotype (wordmark)
│       ├── anbaric-ident.png   # the ident (mark)
│       └── anbaric-ident-black.svg  # the ident in black, for small/muted uses
└── components/         # React components (each: <Name>.tsx, <Name>.css, index.ts)
    ├── BuiltWithAnbaric/  # the small "Built with Anbaric" attribution line
    ├── Card/           # glass surface container, concentric radii
    ├── Form/           # styles + validates contained inputs/buttons
    ├── Slider/         # styled range input
    ├── Graph/          # dependency-free line/area chart
    ├── Tooltip/        # hover/focus label at popover elevation
    └── OptionsMenu/    # trigger + popover action menu
```

---

## How it's wired into a consuming app

The design system is a sibling package consumed via a `file:` dependency, so
edits here are picked up immediately by the consuming app (no
rebuild/reinstall).

```json
"dependencies": {
  "@anbaric/design-system": "file:../anbaric-design-system"
}
```

`design-system/package.json` is ESM and marks CSS as having side effects (so
bundlers don't tree-shake imported global styles). Its `exports` map exposes
the public surface:

```json
"exports": {
  "./tokens.css": "./tokens.css",
  "./components/*": "./components/*",
  "./shared/*": "./shared/*"
}
```

### Usage

```ts
// Global tokens — import once, near your app root.
import '@anbaric/design-system/tokens.css'

// Brand assets resolve to URLs through your bundler.
import logoUrl from '@anbaric/design-system/shared/assets/anbaric-logo.svg'
import identUrl from '@anbaric/design-system/shared/assets/anbaric-ident.svg'
import identBlackUrl from '@anbaric/design-system/shared/assets/anbaric-ident-black.svg'

// The attribution every app built on Anbaric carries, at the foot of the page
// or the bottom of the nav: the black ident plus "Built with Anbaric", small
// and muted so it never competes with the app's own UI.
import { BuiltWithAnbaric } from '@anbaric/design-system/components/BuiltWithAnbaric'
```

Every token is a CSS custom property on `:root`, so reference them directly in
CSS — `color: var(--color-primary)` — or read them in JS via
`getComputedStyle`.

### Preview

Open `index.html` in a browser to see the living style guide. It eats its own
dog food — the page is built entirely from the tokens. Note that the web fonts
load from Google Fonts at runtime, so it needs network access (see Roadmap).

---

## Conventions

**Light theme.** `--color-foreground` is Shadowglass Navy (`#110B2D`) and
`--color-background` is Frost White (`#F9FAFC`). Foreground and
background were defined this way round deliberately — text is foreground,
page/surfaces are background.

**Numbered section pattern.** Section headers use a two-digit IBM Plex Mono
number followed by a body-font subtitle, e.g. `01. Subtitle`. In the style
guide this is the `.eyebrow` / `.eyebrow__num` pattern.

**Cards.** `.card` is a deliberately generic surface (background, border,
radius, clipped overflow) so it can host any content; swatch/specimen/logo
presentation lives in its own classes rather than being baked into `.card`.

---

## Tokens

### Colour

A light palette. Most colours provide a base flanked by a **tint** (toward
white) and a **shade** (toward black). Two colours break that pattern because
of where they sit in the value range, and Accent carries a second hue instead
of a ramp.

| Role | Base | Variants |
| --- | --- | --- |
| Primary — Pan Coral | `#FF7B94` | tint `#FFA1B3`, shade `#C25B72` |
| Accents — Svalbard Blue & Aether Pink | `#5BC6FF` | second accent `--color-accent-2` `#FF5BBE` |
| Foreground — Shadowglass Navy | `#110B2D` | two **tints**: Asriel Ink `#322F60` and `#6E6B96` (a shade would read as black) |
| Background — Frost White | `#F9FAFC` | two **shades**: Glacier Grey `#E7EBF0` and Haze Silver `#D1D6DE` |
| Success | `#61F29D` | tint `#89F5B5`, shade `#49B676` |
| Failure — Bolvangar Crimson | `#E23D5B` | tint `#F0768C`, shade `#A62B44` — invented for the error state, deeper and more urgent than the coral primary |
| Grey — Storm Charcoal | `#2B2E42` | neutral — scrims, dividers, muted UI |

Token names follow `--color-<role>`, `--color-<role>-tint` / `-shade`, with
`--color-foreground-tint-1/2` and `--color-background-shade-1/2` for the
two-step colours, and `--color-accent-2` for the second accent.

### Gradients

| Token | Definition |
| --- | --- |
| `--gradient-ink` | `linear-gradient(180deg, foreground-tint-1, foreground)` — Asriel Ink into Shadowglass Navy, top to bottom; the main gradient, carried by buttons |
| `--gradient-primary-glow` | `radial-gradient(circle at top right, primary, background)` |
| `--gradient-primary-haze` | pale glow — `radial-gradient` of ~16% primary mixed into the background (used for the page) |

### Typography

Fallbacks loaded from Google Fonts.

| Token | Family | Use |
| --- | --- | --- |
| `--font-title` | Druk (fallback: Anton) | headlines — bold, uppercase, 90% line height, used sparingly |
| `--font-body` | Founders Grotesk (fallback: Inter) | body copy and UI |
| `--font-mono` | IBM Plex Mono | labels, numerals, the section numbers |

Druk and Founders Grotesk are licensed faces; the preview loads the free
fallbacks from Google Fonts, and the stacks pick up the real faces wherever
they're installed.

Weight tokens: `--font-weight-light` (300), `--font-weight-regular` (400),
`--font-weight-medium` (500), `--font-weight-semibold` (600),
`--font-weight-bold` (700). Headline treatment tokens:
`--title-line-height` (0.9) and `--title-transform` (uppercase).

### Spacing

Three steps, all in `rem` so spacing scales with the root font-size (keeping
layouts responsive).

| Token | Value | Use |
| --- | --- | --- |
| `--space-sm` | `0.5rem` | padding inside an element (e.g. an input) |
| `--space-md` | `1rem` | padding and gaps between elements within a container |
| `--space-lg` | `2rem` | space between containers |

### Radius — concentric by construction

| Token | Value |
| --- | --- |
| `--radius-element` | `--space-sm` |
| `--radius-container` | `calc(--space-md + --space-sm)` |

An element inside a container is inset by the container's padding
(`--space-md`). For the corners to stay **concentric**, the container's radius
must equal that padding plus the element's own radius — hence
`container = medium + small` and `element = small`. Following the spacing rules
(container padding = medium, element radius = small) makes any element inside a
container automatically concentric with it.

### Elevation

Six levels around the canvas, as `box-shadow` tokens (shadows tinted with the
ink colour to stay in palette). Pair `--elevation-cutout` with a darker surface
(`--color-background-shade-2`) so it reads as a hole you look into.

| Level | Token | Use |
| --- | --- | --- |
| −1 | `--elevation-cutout` | Cutout (inset) — previews & read-only content |
| 0 | `--elevation-0` | Canvas — the main surface (flat) |
| 1 | `--elevation-1` | Card — a super-subtle resting lift |
| 2 | `--elevation-2` | Popover — tooltips & anything transient that moves |
| 3 | `--elevation-3` | Panel — global UI: nav & side panels |
| 4 | `--elevation-4` | Modal — blocking dialogs |

---

## Components

Components ship as source (`.tsx` + `.css`); the consuming app (Vite) compiles
them. Each component's stylesheet is token-driven and is also what the static
style guide (`index.html`) uses, so the guide and the React components never
drift.

### Card

`@anbaric/design-system/components/Card`

A surface container that owns its spacing (medium padding and gaps) and keeps
corners concentric: the card takes the container radius and **every direct
child** is given the element radius.

```tsx
import { Card } from '@anbaric/design-system/components/Card'

<Card>
  <h3>Title</h3>
  <p>Body…</p>
</Card>
```

### Button

`@anbaric/design-system/components/Button`

The primary action component. `variant` (`primary` / `ghost` / `danger`),
`loading`, `iconStart` / `iconEnd`, and `fullWidth`. A masked gradient border
implies a light source; hover shimmers that border and embosses the surface
upward (no height change), and a click presses it in — all quick and subtle.

```tsx
import { Button } from '@anbaric/design-system/components/Button'

<Button onClick={save}>Save</Button>
<Button variant="ghost" iconStart={icon}>Cancel</Button>
<Button variant="danger" loading>Deleting…</Button>
```

### SplitButton

`@anbaric/design-system/components/SplitButton`

A primary action connected to a dropdown of secondary actions. Both segments
reuse the Button styling; the dropdown is a native Popover (top layer,
light-dismiss).

```tsx
import { SplitButton } from '@anbaric/design-system/components/SplitButton'

<SplitButton
  onClick={save}
  items={[
    { label: 'Save and add another', onSelect: saveAndAdd },
    { label: 'Save as draft', onSelect: saveDraft },
  ]}
>
  Save
</SplitButton>
```

### Modal

`@anbaric/design-system/components/Modal`

A blocking dialog at elevation 4 on the native `<dialog>` — top layer, focus
trap, dimmed backdrop, and Escape come for free. Controlled via `open` /
`onClose`; closes on Escape, backdrop click, or the close button.

```tsx
import { Modal } from '@anbaric/design-system/components/Modal'

<Modal open={open} onClose={close} title="Confirm" footer={<Button>OK</Button>}>
  Body…
</Modal>
```

### Drawer

`@anbaric/design-system/components/Drawer`

A large `Card` that slides in from the right over a **fully transparent** (but
still modal) curtain. Native `<dialog>`, so it traps focus and closes on Escape;
clicking the curtain closes it too. Controlled via `open` / `onClose`.

```tsx
import { Drawer } from '@anbaric/design-system/components/Drawer'

<Drawer open={open} onClose={close}>
  Detail panel content…
</Drawer>
```

### Alert

`@anbaric/design-system/components/Alert`

An inline status message in a semantic tone (`info` / `success` / `warning` /
`danger`), with an icon, optional `title`, and optional `onDismiss`. Danger uses
`role="alert"`.

```tsx
import { Alert } from '@anbaric/design-system/components/Alert'

<Alert variant="danger" title="High risk" onDismiss={dismiss}>
  A serious drug–drug interaction was detected.
</Alert>
```

### Badge

`@anbaric/design-system/components/Badge`

A small status label / tag. `tone` (`neutral` / `primary` / `success` /
`warning` / `danger`) and an optional leading `dot`.

```tsx
import { Badge } from '@anbaric/design-system/components/Badge'

<Badge tone="danger" dot>High risk</Badge>
```

### Form

`@anbaric/design-system/components/Form`

Wraps plain HTML inputs and buttons and governs their look and behaviour:

- Styles every contained input/button — clean inputs with a clear border, a
  forced `--color-background` background, and a chunky border on focus.
- Runs native constraint validation; while any field is invalid, every submit
  button inside the form is disabled.
- On blur/submit, shows a warning beneath a failing field, taken from the
  field's `data-warning` attribute (falling back to the browser's message).
- Turns a field **green** the moment it becomes valid (and non-empty) — live,
  as you type, not on submit. The `success` prop greens the whole form (e.g.
  after a save).

```tsx
import { Form } from '@anbaric/design-system/components/Form'

<Form onSubmit={handleSubmit}>
  <label>Email
    <input type="email" required data-warning="Enter a valid email address" />
  </label>
  <button type="submit">Save</button>
</Form>
```

### Slider

`@anbaric/design-system/components/Slider`

A range input whose custom thumb shows the current value and grows (mostly
horizontally) on hover/focus. Supports `min`, `max`, `step`, and `showTicks` to
draw a tick at each step. Works controlled or uncontrolled.

```tsx
import { Slider } from '@anbaric/design-system/components/Slider'

<Slider min={0} max={10} step={1} defaultValue={6} showTicks />
```

### Graph

`@anbaric/design-system/components/Graph`

A line/area chart built on [Recharts](https://recharts.org/). Pass a series of
numbers; colours come from the tokens via `currentColor`, so it stays
on-palette.

```tsx
import { Graph } from '@anbaric/design-system/components/Graph'

<Graph data={[4, 7, 5, 9, 6, 11, 8, 13]} />
```

### Tooltip

`@anbaric/design-system/components/Tooltip`

Shows a label above its trigger on hover or keyboard focus, at popover
elevation.

```tsx
import { Tooltip } from '@anbaric/design-system/components/Tooltip'

<Tooltip label="Helpful context">
  <button>Hover me</button>
</Tooltip>
```

### OptionsMenu

`@anbaric/design-system/components/OptionsMenu`

A trigger button that opens a popover menu of actions. Built on the native
**Popover API** — the menu renders in the top layer (above everything) and
light-dismisses (outside click / Escape) for free; it also closes on selection.

```tsx
import { OptionsMenu } from '@anbaric/design-system/components/OptionsMenu'

<OptionsMenu
  items={[
    { label: 'Edit', onSelect: edit },
    { label: 'Duplicate', onSelect: duplicate },
    { label: 'Archive', disabled: true },
  ]}
/>
```

### Steps

`@anbaric/design-system/components/Steps`

A numbered, named wizard indicator. Steps before `current` read as done, the
current step is highlighted, later steps are muted.

```tsx
import { Steps } from '@anbaric/design-system/components/Steps'

<Steps steps={['Account', 'Profile', 'Plan', 'Review']} current={1} />
```

### LoadingBar

`@anbaric/design-system/components/LoadingBar`

An indeterminate, colourful progress bar (flowing brand gradient + sweeping
sheen) with status messages that cycle while a long task runs. Respects
`prefers-reduced-motion`.

```tsx
import { LoadingBar } from '@anbaric/design-system/components/LoadingBar'

<LoadingBar messages={['Warming up…', 'Crunching…', 'Almost there…']} />
```

### Tabs

`@anbaric/design-system/components/Tabs`

A tab list and panels following the ARIA tabs pattern (click or Arrow/Home/End
keys).

```tsx
import { Tabs } from '@anbaric/design-system/components/Tabs'

<Tabs
  tabs={[
    { label: 'Overview', content: <Overview /> },
    { label: 'Details', content: <Details /> },
  ]}
/>
```

### RadioGroup

`@anbaric/design-system/components/RadioGroup`

Styled radio buttons over native `<input type="radio">` (native keyboard and
form behaviour). Controlled via `value` or uncontrolled via `defaultValue`.

```tsx
import { RadioGroup } from '@anbaric/design-system/components/RadioGroup'

<RadioGroup
  name="plan"
  defaultValue="pro"
  options={[
    { label: 'Free', value: 'free' },
    { label: 'Pro', value: 'pro' },
    { label: 'Enterprise', value: 'enterprise', disabled: true },
  ]}
  onChange={setPlan}
/>
```

### Toggle

`@anbaric/design-system/components/Toggle`

An on/off switch over a native checkbox (`role="switch"`). Optional `label`;
controlled via `checked` or uncontrolled via `defaultChecked`, with
`onChange(checked)`.

```tsx
import { Toggle } from '@anbaric/design-system/components/Toggle'

<Toggle label="Notifications" defaultChecked onChange={setOn} />
```

### SideNav

`@anbaric/design-system/components/SideNav`

A left navigation panel (elevation level 3) on the glass surface. Each item has
an icon and a label; a toggle collapses it to an icons-only rail
(`collapsible`, `defaultCollapsed`). Controlled via `active` or uncontrolled via
`defaultActive`. Icons are any node — the preview uses Google
[Material Symbols](https://fonts.google.com/icons).

```tsx
import { SideNav } from '@anbaric/design-system/components/SideNav'

const sym = (name: string) => <span className="material-symbols-rounded">{name}</span>

<SideNav
  header="Anbaric"
  defaultActive="molecules"
  items={[
    { label: 'Dashboard', value: 'dashboard', icon: sym('dashboard') },
    { label: 'Molecules', value: 'molecules', icon: sym('science') },
  ]}
  onChange={navigate}
/>
```

### Pharmacokinetics (data-vis)

Charts for drug blood-level profiles, built on Recharts and sharing PK types and
helpers from `@anbaric/design-system/components/pk` (`PkSeries`, `auc`, `cmax`).
Series colours come from the palette tokens.

- **`ConcentrationCurve`** — overlays drug concentration–time profiles on one set
  of axes. The shaded area under each curve is its **AUC** (exposure); the marked
  point is its peak concentration (**Cmax / Vmax**). `showAuc` / `showPeak` toggle
  those.
- **`ExposureBars`** — a bar chart comparing one derived metric (`metric="auc"`
  or `"cmax"`) across drugs.

```tsx
import { ConcentrationCurve } from '@anbaric/design-system/components/ConcentrationCurve'
import { ExposureBars } from '@anbaric/design-system/components/ExposureBars'
import type { PkSeries } from '@anbaric/design-system/components/pk'

const drugs: PkSeries[] = [
  { name: 'Compound A', data: [{ time: 0, concentration: 0 }, /* … */] },
  { name: 'Compound B', data: [/* … */] },
]

<ConcentrationCurve series={drugs} />
<ExposureBars series={drugs} metric="auc" />
```

---

## Roadmap

- **More components** building on Card and Form, exported via the package's
  `exports` map.
- **Self-host the fonts** (e.g. `@fontsource/*`) so apps don't depend on the
  Google Fonts CDN at runtime.
- **Build/types step** — components currently ship as source; add a build that
  emits JS + `.d.ts` and point `exports` at `dist/` once the surface settles.
