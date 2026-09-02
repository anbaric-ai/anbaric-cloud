import {
  StrictMode,
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createRoot } from 'react-dom/client'

import { Card } from '../components/Card'
import { Section } from '../components/Section'
import { Button } from '../components/Button'
import { SplitButton } from '../components/SplitButton'
import { Modal } from '../components/Modal'
import { Drawer } from '../components/Drawer'
import { Alert } from '../components/Alert'
import { Badge } from '../components/Badge'
import { Form } from '../components/Form'
import { Slider } from '../components/Slider'
import { Graph } from '../components/Graph'
import { Tooltip } from '../components/Tooltip'
import { OptionsMenu } from '../components/OptionsMenu'
import { ConcentrationCurve } from '../components/ConcentrationCurve'
import { ExposureBars } from '../components/ExposureBars'
import { AnnotatedDiagram } from '../components/Annotation'
import type { PkSeries } from '../components/pk'
import { Steps } from '../components/Steps'
import { LoadingBar } from '../components/LoadingBar'
import { Tabs } from '../components/Tabs'
import { RadioGroup } from '../components/RadioGroup'
import { Toggle } from '../components/Toggle'
import { SideNav } from '../components/SideNav'
import { AvatarMenu } from '../components/AvatarMenu'
import { AppNav } from '../components/AppNav'

import logoUrl from '../shared/assets/anbaric-logo.png'
import identUrl from '../shared/assets/anbaric-ident.png'

const vars = (v: Record<string, string>) => v as CSSProperties

// Labels stack above their field; the Form styles the inputs themselves.
const field: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
}

/* ----------------------------------------------------------------- Logos -- */
function Logos() {
  return (
    <>
      <Card>
        <div className="logo-stage logo-stage--wordmark">
          <img src={logoUrl} alt="Anbaric logotype" />
        </div>
        <div className="card__meta">
          <span className="card__name">Logotype</span>
          <code className="card__token">shared/assets/anbaric-logo.png</code>
        </div>
      </Card>
      <Card>
        <div className="logo-stage logo-stage--ident">
          <img src={identUrl} alt="Anbaric ident" />
        </div>
        <div className="card__meta">
          <span className="card__name">Ident</span>
          <code className="card__token">shared/assets/anbaric-ident.png</code>
        </div>
      </Card>
    </>
  )
}

/* -------------------------------------------------------------- Palette -- */
interface Swatch {
  token: string
  hex: string
  dark?: boolean
  main?: boolean
  full?: boolean
}
interface ColourCard {
  name: string
  swatches: Swatch[]
}

const palette: ColourCard[] = [
  {
    name: 'Primary · Pan Coral',
    swatches: [
      { token: '--color-primary', hex: '#FF7B94', main: true, dark: true },
      { token: '--color-primary-tint', hex: '#FFA1B3' },
      { token: '--color-primary-shade', hex: '#C25B72', dark: true },
    ],
  },
  {
    name: 'Foreground · Shadowglass Navy',
    swatches: [
      { token: '--color-foreground', hex: '#110B2D', main: true, dark: true },
      { token: '--color-foreground-tint-1', hex: '#322F60', dark: true },
      { token: '--color-foreground-tint-2', hex: '#6E6B96', dark: true },
    ],
  },
  {
    name: 'Background · Frost White',
    swatches: [
      { token: '--color-background', hex: '#F9FAFC', main: true },
      { token: '--color-background-shade-1', hex: '#E7EBF0' },
      { token: '--color-background-shade-2', hex: '#D1D6DE' },
    ],
  },
  {
    name: 'Accents · Svalbard Blue & Aether Pink',
    swatches: [
      { token: '--color-accent', hex: '#5BC6FF', main: true },
      { token: '--color-accent-2', hex: '#FF5BBE', full: true, dark: true },
    ],
  },
  {
    name: 'Success',
    swatches: [
      { token: '--color-success', hex: '#61F29D', main: true },
      { token: '--color-success-tint', hex: '#89F5B5' },
      { token: '--color-success-shade', hex: '#49B676' },
    ],
  },
  {
    name: 'Failure · Bolvangar Crimson',
    swatches: [
      { token: '--color-failure', hex: '#E23D5B', main: true, dark: true },
      { token: '--color-failure-tint', hex: '#F0768C' },
      { token: '--color-failure-shade', hex: '#A62B44', dark: true },
    ],
  },
  {
    name: 'Grey · Storm Charcoal',
    swatches: [
      { token: '--color-grey', hex: '#2B2E42', main: true, dark: true },
    ],
  },
]


function SwatchView({ token, hex, dark, main, full }: Swatch) {
  const className = ['swatch', main && 'swatch--main', full && 'swatch--full']
    .filter(Boolean)
    .join(' ')
  const style = vars({
    '--swatch': `var(${token})`,
    ...(dark ? { '--swatch-label': 'var(--color-background)' } : {}),
  })
  return (
    <span className={className} style={style}>
      <span className="swatch__hex">{hex}</span>
      <span className="swatch__token">{token}</span>
    </span>
  )
}

function Palette() {
  return (
    <>
      {palette.map((card) => (
        <Card key={card.name}>
          <div className="swatches">
            {card.swatches.map((s) => (
              <SwatchView key={s.token} {...s} />
            ))}
          </div>
          <div className="card__meta">
            <span className="card__name">{card.name}</span>
          </div>
        </Card>
      ))}
    </>
  )
}

/* ------------------------------------------------------------ Gradients -- */
function Gradients() {
  return (
    <>
      <Card>
        <div
          className="swatch swatch--gradient"
          style={vars({
            '--swatch': 'var(--gradient-ink)',
            '--swatch-label': 'var(--color-background)',
          })}
        >
          <span className="swatch__token">--gradient-ink</span>
        </div>
        <div className="card__meta">
          <span className="card__name">Asriel Ink → Shadowglass Navy</span>
          <code className="card__token">linear · top to bottom</code>
        </div>
      </Card>
      <Card>
        <div
          className="swatch swatch--gradient"
          style={vars({ '--swatch': 'var(--gradient-primary-glow)' })}
        >
          <span className="swatch__token">--gradient-primary-glow</span>
        </div>
        <div className="card__meta">
          <span className="card__name">Primary glow</span>
          <code className="card__token">radial · top right</code>
        </div>
      </Card>
      <Card>
        <div
          className="swatch swatch--gradient"
          style={vars({ '--swatch': 'var(--gradient-primary-haze)' })}
        >
          <span className="swatch__token">--gradient-primary-haze</span>
        </div>
        <div className="card__meta">
          <span className="card__name">Primary haze</span>
          <code className="card__token">radial · pale</code>
        </div>
      </Card>
    </>
  )
}

/* ----------------------------------------------------------- Typography -- */
function Typography() {
  return (
    <>
      <Card className="specimen">
        <div className="specimen__label">
          <span>Title · Druk</span>
          <span>Bold · uppercase · 90% line height</span>
        </div>
        <p className="specimen__sample title-bold">
          Move at the speed of thought
        </p>
      </Card>
      <Card className="specimen">
        <div className="specimen__label">
          <span>Body light · Founders Grotesk</span>
          <span>Light · 300</span>
        </div>
        <p className="specimen__sample title-light">
          Move at the speed of thought
        </p>
      </Card>
      <Card className="specimen">
        <div className="specimen__label">
          <span>Body · Founders Grotesk</span>
          <span>Regular · 400</span>
        </div>
        <p className="specimen__sample body-sample">
          The quick brown fox jumps over the lazy dog. Body copy is set in
          Founders Grotesk for its even rhythm and clarity at small sizes,
          keeping long-form reading comfortable across the interface.
        </p>
      </Card>
      <Card className="specimen">
        <div className="specimen__label">
          <span>Mono · IBM Plex Mono</span>
          <span>Medium · 500</span>
        </div>
        <p className="specimen__sample mono-sample">
          0123456789 &nbsp; const anbaric = "ready";
        </p>
      </Card>
      <Card className="specimen">
        <div className="specimen__label">
          <span>Pattern · Numbered section</span>
          <span>Mono number + body subtitle</span>
        </div>
        <p className="specimen__sample eyebrow" style={{ fontSize: '1.5rem' }}>
          <span className="eyebrow__num">01.</span> Subtitle
        </p>
      </Card>
    </>
  )
}

/* -------------------------------------------------------------- Spacing -- */
function Spacing() {
  const steps = [
    ['Small', '--space-sm', '0.5rem', 'element padding'],
    ['Medium', '--space-md', '1rem', 'container padding & gaps'],
    ['Large', '--space-lg', '2rem', 'between containers'],
  ] as const
  return (
    <>
      <Card className="specimen">
        <div className="specimen__label">
          <span>Spacing scale</span>
          <span>rem-based · responsive</span>
        </div>
        <ul className="spacing-scale">
          {steps.map(([name, token, rem, use]) => (
            <li key={token}>
              <span className="spacing-scale__name">{name}</span>
              <div className="spacing-scale__track">
                <span
                  className="spacing-scale__bar"
                  style={{ inlineSize: `var(${token})` }}
                />
                <code className="spacing-scale__meta">
                  {token} · {rem} · {use}
                </code>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="specimen">
        <div className="specimen__label">
          <span>Concentric radii</span>
          <span>container = md + sm · element = sm</span>
        </div>
        <div className="demo-container">
          <div className="demo-element">Element · small padding, element radius</div>
          <div className="demo-element">Element · small padding, element radius</div>
          <input
            className="demo-input"
            placeholder="Input — small padding, element radius"
          />
        </div>
      </Card>
    </>
  )
}

/* ----------------------------------------------------------- Components -- */
function Sym({ name }: { name: string }) {
  return (
    <span className="material-symbols-rounded" aria-hidden="true">
      {name}
    </span>
  )
}

function ComponentDemos() {
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const row: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-sm)',
    alignItems: 'center',
  }
  const stack: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
  }
  return (
    <>
      <Section title="Card">
        <p className="component-demo__body">
          A glass surface with a 1px frame behind it. Its direct children each
          take the element radius — concentric inside the card's container
          radius.
        </p>
        <Card>
          <p className="component-demo__body">
            This paragraph, the field and the panel are direct children of the
            Card.
          </p>
          <input
            className="component-demo__input"
            placeholder="A field — element radius, small padding"
          />
          <div className="component-demo__panel">
            A direct-child panel — element radius
          </div>
        </Card>
      </Section>

      <Section title="Section">
        <p className="component-demo__body">
          A lighter alternative to Card: a title with an optional rule and its
          content, but no surface or padding — for structuring a page without a
          stack of glass panels. A Card may sit inside a Section, never a
          Section inside a Card.
        </p>
        <Section
          title="Recent activity"
          actions={<Badge tone="neutral">12</Badge>}
        >
          <Card>
            <p className="component-demo__body">
              A Card sitting inside a Section — the allowed nesting.
            </p>
          </Card>
        </Section>
        <Section title="No rule" rule={false}>
          <p className="component-demo__body">
            Pass <code>rule=&#123;false&#125;</code> to drop the divider.
          </p>
        </Section>
      </Section>

      <Section title="Button">
        <p className="component-demo__body">
          The main ink gradient as the fill, with a plain border. Hover embosses
          the surface up (no jump) and a click presses it in. Variants, icons,
          and a loading state.
        </p>
        <div style={row}>
          <Button>Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div>
        <div style={row}>
          <Button iconStart={<Sym name="rocket_launch" />}>Launch</Button>
          <Button iconEnd={<Sym name="arrow_forward" />}>Next</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Split button">
        <p className="component-demo__body">
          A primary action with a connected dropdown of secondary actions (a
          native popover).
        </p>
        <div style={row}>
          <SplitButton
            items={[
              { label: 'Save and add another' },
              { label: 'Save as draft' },
              { label: 'Discard', disabled: true },
            ]}
          >
            Save
          </SplitButton>
        </div>
      </Section>

      <Section title="Form">
        <p className="component-demo__body">
          Try submitting empty, then fill it in. The Form disables submit while
          any field is invalid, shows each field's warning on blur, and turns
          green on a valid submit.
        </p>
        <Form onSubmit={(event) => event.preventDefault()}>
          <label style={field}>
            Email
            <input
              type="email"
              required
              data-warning="Enter a valid email address"
              placeholder="you@example.com"
            />
          </label>
          <label style={field}>
            Name
            <input
              required
              data-warning="Please enter your name"
              placeholder="Your name"
            />
          </label>
          <button type="submit">Submit</button>
        </Form>
      </Section>

      <Section title="Slider">
        <p className="component-demo__body">
          The thumb shows the value and grows on hover. Supports min, max, step
          and tick marks.
        </p>
        <Slider defaultValue={35} aria-label="Continuous slider" />
        <Slider
          min={0}
          max={10}
          step={1}
          defaultValue={6}
          showTicks
          aria-label="Stepped slider with ticks"
        />
      </Section>

      <Section title="Radio group">
        <p className="component-demo__body">Pick one. Keyboard-navigable.</p>
        <RadioGroup
          name="plan"
          defaultValue="pro"
          options={[
            { label: 'Free', value: 'free' },
            { label: 'Pro', value: 'pro' },
            { label: 'Enterprise', value: 'enterprise' },
            { label: 'Legacy (unavailable)', value: 'legacy', disabled: true },
          ]}
        />
      </Section>

      <Section title="Toggle">
        <p className="component-demo__body">An on/off switch over a native checkbox.</p>
        <div style={row}>
          <Toggle label="Wi-Fi" defaultChecked />
          <Toggle label="Notifications" />
          <Toggle label="Disabled" disabled />
        </div>
      </Section>

      <Section title="Tabs">
        <p className="component-demo__body">
          Click or use arrow keys to switch.
        </p>
        <Tabs
          tabs={[
            {
              label: 'Overview',
              content: <p className="component-demo__body">A high-level summary.</p>,
            },
            {
              label: 'Details',
              content: <p className="component-demo__body">The finer points.</p>,
            },
            {
              label: 'Activity',
              content: <p className="component-demo__body">Recent events.</p>,
            },
          ]}
        />
      </Section>

      <Section title="Steps">
        <p className="component-demo__body">
          A numbered wizard indicator with a current step.
        </p>
        <Steps steps={['Account', 'Profile', 'Plan', 'Review']} current={1} />
      </Section>

      <Section title="Options menu" style={{ minHeight: '14rem' }}>
        <p className="component-demo__body">
          A trigger that opens a popover menu of actions. Click it.
        </p>
        <OptionsMenu
          align="start"
          items={[
            { label: 'Edit' },
            { label: 'Duplicate' },
            { label: 'Archive', disabled: true },
          ]}
        />
      </Section>

      <Section title="Avatar menu">
        <p className="component-demo__body">
          A person's avatar that opens a popover account menu. The menu fades in
          above the avatar — which stays put at its foot — with the identity and
          actions above, as it would at the bottom of a nav. Initials stand in
          when there's no image.
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-start',
            minHeight: '15rem',
          }}
        >
          <AvatarMenu
            name="Ada Lovelace"
            subtitle="ada@anbaric.ai"
            items={[
              { label: 'Profile' },
              { label: 'Settings' },
              { label: 'Sign out' },
            ]}
          />
        </div>
      </Section>

      <Section title="Left nav">
        <p className="component-demo__body">
          A side navigation panel. <code>{'{ section }'}</code> entries draw a
          labelled divider; a <code>badge</code> adds a trailing count; items
          with <code>href</code> render as links, and <code>external</code> ones
          open in a new tab.
        </p>
        <SideNav
          header="Anbaric"
          defaultActive="jobs"
          items={[
            { label: 'Dashboard', value: 'dashboard', icon: <Sym name="dashboard" /> },
            { label: 'Jobs', value: 'jobs', icon: <Sym name="account_tree" />, badge: '12' },
            { label: 'Settings', value: 'settings', icon: <Sym name="settings" />, disabled: true },
            { section: 'Apps' },
            { label: 'CRM', value: 'crm', href: '#', external: true, icon: <Sym name="deployed_code" /> },
          ]}
        />
      </Section>

      <Section title="Modal">
        <p className="component-demo__body">
          A blocking dialog at elevation 4 (native &lt;dialog&gt;): dimmed
          backdrop, focus trap, Escape and backdrop-click to close.
        </p>
        <div style={row}>
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
        </div>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Replace app"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>Confirm</Button>
            </>
          }
        >
          <p className="component-demo__body">
            The app is already running. Replacing it will re-bake the image and
            restart its container.
          </p>
        </Modal>
      </Section>

      <Section title="Drawer">
        <p className="component-demo__body">
          A large Card that slides in from the right over a fully transparent
          curtain. Click the curtain or press Escape to close.
        </p>
        <div style={row}>
          <Button variant="ghost" onClick={() => setDrawerOpen(true)}>
            Open drawer
          </Button>
        </div>
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <h3 className="component-demo__title">Job detail</h3>
          <p className="component-demo__body">
            Detail panel content lives here — job properties, state history, anything.
          </p>
          <Button onClick={() => setDrawerOpen(false)}>Done</Button>
        </Drawer>
      </Section>

      <Section title="Alert">
        <p className="component-demo__body">Inline status messages.</p>
        <div style={stack}>
          <Alert variant="info" title="Heads up">
            Two state machines subscribe to this queue.
          </Alert>
          <Alert variant="success" title="Deploy complete">
            The app is live behind the platform proxy.
          </Alert>
          <Alert variant="warning" title="Monitor">
            A job has been waiting on human input for two days.
          </Alert>
          <Alert variant="danger" title="Deploy failed" onDismiss={() => {}}>
            The app did not respond on its configured port.
          </Alert>
        </div>
      </Section>

      <Section title="Badge">
        <p className="component-demo__body">Small status labels and tags.</p>
        <div style={row}>
          <Badge>Neutral</Badge>
          <Badge tone="primary">workflow</Badge>
          <Badge tone="success" dot>
            Live
          </Badge>
          <Badge tone="warning" dot>
            Monitor
          </Badge>
          <Badge tone="danger" dot>
            Failed
          </Badge>
        </div>
      </Section>

      <Section title="Tooltip">
        <p className="component-demo__body">
          Hover or focus the{' '}
          <Tooltip label="Helpful context appears here">
            <span
              style={{ textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
            >
              underlined term
            </span>
          </Tooltip>{' '}
          to reveal a label at popover elevation.
        </p>
      </Section>

      <Section title="Loading bar">
        <p className="component-demo__body">
          An indeterminate, colourful bar with messages that cycle while a long
          task runs.
        </p>
        <LoadingBar />
      </Section>

      <Section title="Graph">
        <p className="component-demo__body">
          A lightweight, dependency-free line/area chart that scales to its
          container.
        </p>
        <Graph data={[4, 7, 5, 9, 6, 11, 8, 13]} aria-label="Example trend line" />
      </Section>
    </>
  )
}

/* ------------------------------------------------------ Pharmacokinetics -- */
const drugs: PkSeries[] = [
  {
    name: 'Compound A',
    data: [
      { time: 0, concentration: 0 },
      { time: 0.5, concentration: 3.2 },
      { time: 1, concentration: 6.5 },
      { time: 2, concentration: 8.1 },
      { time: 3, concentration: 7.0 },
      { time: 4, concentration: 5.4 },
      { time: 6, concentration: 3.0 },
      { time: 8, concentration: 1.7 },
      { time: 12, concentration: 0.5 },
    ],
  },
  {
    name: 'Compound B',
    data: [
      { time: 0, concentration: 0 },
      { time: 0.5, concentration: 1.4 },
      { time: 1, concentration: 2.9 },
      { time: 2, concentration: 4.8 },
      { time: 3, concentration: 6.0 },
      { time: 4, concentration: 6.3 },
      { time: 6, concentration: 5.2 },
      { time: 8, concentration: 3.9 },
      { time: 12, concentration: 2.0 },
    ],
  },
  {
    name: 'Compound C',
    data: [
      { time: 0, concentration: 0 },
      { time: 0.5, concentration: 2.0 },
      { time: 1, concentration: 3.4 },
      { time: 2, concentration: 3.9 },
      { time: 3, concentration: 3.2 },
      { time: 4, concentration: 2.6 },
      { time: 6, concentration: 1.5 },
      { time: 8, concentration: 0.8 },
      { time: 12, concentration: 0.2 },
    ],
  },
]

function PkDemos() {
  return (
    <>
      <Card>
        <h3 className="component-demo__title">Concentration–time curve</h3>
        <p className="component-demo__body">
          Blood concentration over time for three compounds on one axis. The
          shaded area under each curve is its AUC — total exposure integrated
          over time; the marked point is the peak (Cmax / Vmax).
        </p>
        <ConcentrationCurve series={drugs} />
      </Card>
      <Card>
        <h3 className="component-demo__title">AUC comparison</h3>
        <p className="component-demo__body">
          Total exposure per compound, integrated over the time course.
        </p>
        <ExposureBars series={drugs} metric="auc" />
      </Card>
      <Card>
        <h3 className="component-demo__title">Peak comparison</h3>
        <p className="component-demo__body">
          The peak concentration (Cmax / Vmax) each compound reaches over time.
        </p>
        <ExposureBars series={drugs} metric="cmax" />
      </Card>
    </>
  )
}

function AnnotationDemo() {
  return (
    <Card>
      <h3 className="component-demo__title">Annotated diagram</h3>
      <p className="component-demo__body">
        Leader lines and labels for calling out parts of a diagram. Labels
        collect into side gutters and are decluttered so they never overlap;
        leaders use a single 45° elbow — never a curve. Tone carries meaning,
        and a problem can emit a pulsing wave (amber or red) that ripples out
        from its point.
      </p>
      <AnnotatedDiagram
        width={260}
        height={190}
        annotations={[
          { id: 'coat', x: 130, y: 32, title: 'Film coat', detail: 'Protects the core', side: 'right' },
          { id: 'core', x: 130, y: 95, title: 'Active core', detail: 'API + excipients', tone: 'primary', side: 'right' },
          { id: 'breach', x: 196, y: 128, title: 'Coating breach', detail: 'Dissolution risk', tone: 'danger', pulse: true, side: 'right' },
        ]}
      >
        <ellipse
          cx={130}
          cy={95}
          rx={94}
          ry={62}
          fill="var(--color-background-shade-2)"
          stroke="var(--color-foreground-tint-2)"
          strokeWidth={1.5}
        />
        <ellipse
          cx={130}
          cy={95}
          rx={48}
          ry={32}
          fill="color-mix(in srgb, var(--color-primary) 16%, var(--color-background))"
          stroke="var(--color-primary)"
          strokeWidth={1.25}
        />
      </AnnotatedDiagram>
    </Card>
  )
}

/* ------------------------------------------------------------ Elevation -- */
function Elevation() {
  const levels = [
    ['cutout', '−1', 'Cutout — previews & read-only content'],
    ['0', '0', 'Canvas — the main surface'],
    ['1', '1', 'Card — super-subtle resting lift'],
    ['2', '2', 'Popover — tooltips & anything that moves'],
    ['3', '3', 'Panel — nav & side panels'],
    ['4', '4', 'Modal — blocking dialogs'],
  ] as const
  return (
    <>
      {levels.map(([mod, label, use]) => (
        <div key={mod} className={`elevation elevation--${mod}`}>
          <span className="elevation__level">{label}</span>
          <span className="elevation__use">{use}</span>
        </div>
      ))}
    </>
  )
}

/* ----------------------------------------------------------------- Views -- */
function PageSection({
  n,
  title,
  lead,
  id,
  children,
}: {
  n: string
  title: string
  lead?: ReactNode
  id?: string
  children: ReactNode
}) {
  return (
    <section className="section" id={id}>
      <h2 className="eyebrow">
        <span className="eyebrow__num">{n}</span> {title}
      </h2>
      {lead ? <p className="section__lead">{lead}</p> : null}
      {children}
    </section>
  )
}

/* Cross-page navigation: switch view and (optionally) scroll to a section. */
const NavContext = createContext<(view: string, anchor?: string) => void>(() => {})

function GuidanceLink({ anchor, label = 'Read the guidance' }: { anchor: string; label?: string }) {
  const navigate = useContext(NavContext)
  return (
    <button type="button" className="guidance-link" onClick={() => navigate('guidance', anchor)}>
      {label}
      <Sym name="arrow_forward" />
    </button>
  )
}

function Foundations() {
  return (
    <>
      <PageSection
        n="01."
        title="Logos"
        lead={
          <>
            The Anbaric logotype on dark and light, and the ident.{' '}
            <GuidanceLink anchor="guidance-logos" />
          </>
        }
      >
        <div className="logos">
          <Logos />
        </div>
      </PageSection>
      <PageSection
        n="02."
        title="Colour palette"
        lead={
          <>
            Each card leads with its base colour, with its variants beneath.{' '}
            <GuidanceLink anchor="guidance-colour" />
          </>
        }
      >
        <div className="palette">
          <Palette />
        </div>
      </PageSection>
      <PageSection
        n="03."
        title="Gradients"
        lead={
          <>
            The main ink gradient, a radial glow, and a pale haze.{' '}
            <GuidanceLink anchor="guidance-gradients" />
          </>
        }
      >
        <div className="gradients">
          <Gradients />
        </div>
      </PageSection>
      <PageSection
        n="04."
        title="Typography"
        lead={
          <>
            Druk for titles, Founders Grotesk for body, IBM Plex Mono for
            labels. Licensed faces — free fallbacks load when they're absent. <GuidanceLink anchor="guidance-typography" />
          </>
        }
      >
        <div className="specimens">
          <Typography />
        </div>
      </PageSection>
      <PageSection
        n="05."
        title="Spacing & containers"
        lead={
          <>
            A three-step rem scale, and concentric radii.{' '}
            <GuidanceLink anchor="guidance-spacing" />
          </>
        }
      >
        <div className="specimens">
          <Spacing />
        </div>
      </PageSection>
      <PageSection
        n="06."
        title="Elevation"
        lead={
          <>
            Six levels around the canvas; shadows tinted with the ink colour.{' '}
            <GuidanceLink anchor="guidance-elevation" />
          </>
        }
      >
        <div className="elevations">
          <Elevation />
        </div>
      </PageSection>
    </>
  )
}

function Components() {
  return (
    <>
      <PageSection
        n="01."
        title="Components"
        lead={
          <>
            The interactive component kit.{' '}
            <GuidanceLink anchor="guidance-components" label="Read the component guidance" />
          </>
        }
      >
        <div className="components">
          <ComponentDemos />
        </div>
      </PageSection>
      <PageSection
        n="02."
        title="Data visualisation"
        lead={
          <>
            Drug blood-levels over time — the basis for metabolism metrics. AUC is
            total exposure integrated over the curve; the peak (Cmax / Vmax) is the
            most a drug reaches. The curve is the primary, over-time view; the bars
            summarise each metric across drugs.{' '}
            <GuidanceLink anchor="guidance-dataviz" />
          </>
        }
      >
        <div className="components">
          <PkDemos />
        </div>
      </PageSection>
      <PageSection
        n="03."
        title="Diagram annotation"
        lead={
          <>
            Call out parts of a diagram with leader lines and labels — for
            anatomy, molecules, device schematics or charts.{' '}
            <GuidanceLink anchor="guidance-annotation" />
          </>
        }
      >
        <div className="components">
          <AnnotationDemo />
        </div>
      </PageSection>
    </>
  )
}

function GuidanceCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h3 className="component-demo__title">{title}</h3>
      {children}
    </Card>
  )
}

function Guidance() {
  return (
    <>
      <p className="section__lead" style={{ maxWidth: '46rem', marginBottom: 'var(--space-lg)' }}>
        How to put Anbaric to work. The sections below mirror the design system —
        first the Foundations, then the Components — and for each give the
        how and the why, the best practices to follow, and concrete examples.
      </p>

      {/* ---------- Foundations ---------- */}

      <PageSection id="guidance-logos" n="01." title="Logos" lead="The logotype and ident, and where each belongs.">
        <div className="guidance-grid">
          <GuidanceCard title="How to use it">
            <p className="component-demo__body">
              The <strong>logotype</strong> (mark + wordmark) is the default
              signature — use it wherever there's room to read it: marketing,
              document headers, the splash. The <strong>ident</strong> (mark
              alone) is for tight or square spaces: the favicon, an app icon, an
              avatar.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Why">
            <p className="component-demo__body">
              One mark applied consistently is what makes a product feel like
              itself. Giving each context the right variant keeps the brand
              legible at every size rather than forcing one lockup to do every
              job badly.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Best practices">
            <p className="component-demo__body">
              Give the logo clear space and never recolour, stretch or add effects
              to it. Use the full colour logo on light, dark or
              Shadowglass surfaces, and the one colour colourways elsewhere —
              pick by contrast, not taste. Reach for the ident only when the full wordmark won't read.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection id="guidance-colour" n="02." title="Colour" lead="A small palette — use colour to mean something.">
        <div className="guidance-grid">
          <GuidanceCard title="How to use it">
            <p className="component-demo__body">
              Build everything from the tokens. <strong>Foreground</strong> is ink
              for text and icons; <strong>background</strong> is the surface
              beneath. <strong>Primary</strong> drives the key action and points
              of emphasis. The two <strong>accents</strong> are for sparing
              highlights. <strong>Success</strong> and <strong>failure</strong>
              {' '}carry real status only, and <strong>grey</strong> is the one
              hueless colour — scrims, dividers, muted UI.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Why">
            <p className="component-demo__body">
              Anbaric products surface the state of real work — jobs, deploys,
              approvals — so colour has to be trustworthy: when crimson always
              means failure and green always means clear, people can read a
              verdict at a glance. A small, disciplined
              palette is what makes that signal reliable.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Best practices">
            <p className="component-demo__body">
              For hovers, active states and borders, reach for a colour's
              tint or shade rather than a new hue — stay in the family. Never
              reuse status colours for decoration. Check contrast when putting
              foreground on a coloured fill; when in doubt, drop to the shade
              variant.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Example">
            <p className="component-demo__body">
              A primary button is <code>--color-primary</code> with foreground
              text; its hover mixes a little ink in via
              <code> color-mix</code>. A “failed” badge uses
              <code> --color-failure</code>; a “live” badge uses
              <code> --color-success</code>. The same crimson never appears just
              to look striking.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection id="guidance-gradients" n="03." title="Gradients" lead="Accents and atmosphere — never reading surfaces.">
        <div className="guidance-grid">
          <GuidanceCard title="How to use it">
            <p className="component-demo__body">
              Three blends, each with a role. The pale
              <code> --gradient-primary-haze</code> is the page backdrop. The
              radial <code> --gradient-primary-glow</code> is bolder — for a hero
              area or a single feature surface — and the vertical
              {' '}<code>--gradient-ink</code> is the main gradient: the ink
              pair, carried by buttons.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Why">
            <p className="component-demo__body">
              The haze gives every page a quiet sense of depth that the glass
              cards then blur through, tying the whole surface together. The
              stronger gradients add brand energy exactly where you want a focal
              point — and nowhere else.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Best practices">
            <p className="component-demo__body">
              Don't set long-form text directly over a gradient — legibility
              first. Use the haze for large areas and keep the bold blends rare,
              one focal point per view. A faint fixed noise over the haze stops
              large fills from banding.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection id="guidance-typography" n="04." title="Typography" lead="Three families, each with one job.">
        <div className="guidance-grid">
          <GuidanceCard title="How to use it">
            <p className="component-demo__body">
              <strong>Druk</strong> for titles — bold, uppercase, 90% line
              height, used sparingly — <strong>Founders Grotesk</strong> for
              body, and <strong>IBM Plex Mono</strong> for labels, numerals and
              code. The signature move is a section header pairing a two-digit
              mono number with a body subtitle — “01. Colour”.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Why">
            <p className="component-demo__body">
              Each family is tuned to its task: Druk delivers precision and
              confidence in moments of emphasis, Founders Grotesk is calm and
              legible at length, and mono's fixed width keeps figures and code
              aligned.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Best practices">
            <p className="component-demo__body">
              Keep roles distinct — don't set body in mono or titles in the display face.
              Let size and weight carry hierarchy, not colour. Hold body copy to a
              60–70 character measure. Use the numbered pattern for top-level
              sections only, so it stays special.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection id="guidance-spacing" n="05." title="Spacing & containers" lead="A three-step rem scale, with radii derived from it.">
        <div className="guidance-grid">
          <GuidanceCard title="How to use it">
            <p className="component-demo__body">
              Three steps: <strong>small</strong> is padding inside an element,
              {' '}<strong>medium</strong> is padding and gaps within a container,
              {' '}<strong>large</strong> is space between containers. Radii are
              concentric — container = medium + small, element = small — so
              children round in step with their container.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Why">
            <p className="component-demo__body">
              A tiny, consistent scale removes a thousand arbitrary decisions and
              makes layouts feel composed rather than assembled. Working in rem
              means the whole UI scales with the root font-size, so it respects a
              reader's text-size settings.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Best practices">
            <p className="component-demo__body">
              Reach for a token, never a magic pixel value. Honour the padding
              rule and the concentric radii take care of themselves. Consistent
              rhythm — large between, medium within, small inside — does more for
              cohesion than any single clever layout.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection id="guidance-elevation" n="06." title="Elevation" lead="Six levels around the canvas; each has a job.">
        <div className="guidance-grid">
          <GuidanceCard title="How to use it">
            <p className="component-demo__body">
              The scale: <strong>−1</strong> cutout · <strong>0</strong> canvas ·
              {' '}<strong>1</strong> card · <strong>2</strong> popover and
              anything transient that moves · <strong>3</strong> nav and side
              panels · <strong>4</strong> modals. Pick the level by how transient
              and attention-grabbing the surface is.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Why">
            <p className="component-demo__body">
              Depth tells people what a thing is before they read it — a resting
              card, a floating menu, a blocking dialog. Tinting the shadows with
              ink keeps them in palette, so elevation reads as part of the system
              rather than a generic drop shadow.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Best practices">
            <p className="component-demo__body">
              The cutout (−1) reads as a hole, so it lives <em>only</em> on the
              main canvas — never inside a card, popover, panel or modal; you
              can't look through a floating surface. Don't jump to a higher level
              just for a bigger shadow. Keep reading surfaces like modals opaque
              while glass cards stay translucent.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      {/* ---------- Components ---------- */}

      <PageSection id="guidance-components" n="07." title="Cards & surfaces" lead="The Card — the container everything else sits in.">
        <div className="guidance-grid">
          <GuidanceCard title="How to use it">
            <p className="component-demo__body">
              The Card is the standard surface: glass fill, a 1px sheened frame,
              container radius and resting elevation 1. Wrap a group of related
              content in one and let its medium padding do the spacing. Direct
              children automatically take the smaller element radius.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Why">
            <p className="component-demo__body">
              A single shared surface is what makes screens feel like one product.
              Because the Card owns padding, radius and elevation, you compose
              layouts without re-deciding those each time — and everything stays
              concentric and consistent for free.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Best practices">
            <p className="component-demo__body">
              One idea per card. Don't nest cards deeply or stack their shadows —
              reach for sections inside one card instead. Keep the glass at
              elevation 1 at rest; let overlays and panels carry the higher
              levels.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection n="08." title="Buttons & actions" lead="Button, split button and options menu — how people act.">
        <div className="guidance-grid">
          <GuidanceCard title="How to use it">
            <p className="component-demo__body">
              One <strong>Button</strong> with a few intents: solid for the
              primary action, ghost for everything secondary, and danger for a
              destructive one. A <strong>split button</strong> pairs a default
              action with a menu of related ones. The <strong>options
              menu</strong> (a native popover) collects overflow and contextual
              actions behind a single trigger.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Why">
            <p className="component-demo__body">
              Keeping one strong emphasis per view makes the primary path
              obvious — decision-making is easier when a single button clearly
              leads, with danger reserved to make destructive actions feel
              different. Splits and menus keep less-common actions within reach
              without crowding the main one.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Best practices">
            <p className="component-demo__body">
              At most one solid button per view or group; make the rest ghost.
              Label with a verb (“Compare drugs”, not “OK”). Put the most common
              action on the face of a split button. Don't bury a destructive or
              primary action inside an options menu.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Example">
            <p className="component-demo__body">
              A results toolbar: a solid “Run analysis”, a ghost “Reset”, and an
              options menu (⋯) holding “Export CSV”, “Share” and “Print”. A split
              button “Add drug ▾” defaults to a search but opens recent picks.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection n="09." title="Form controls" lead="Form, slider, radio group and toggle — capturing input.">
        <div className="guidance-grid">
          <GuidanceCard title="How to use it">
            <p className="component-demo__body">
              The <strong>Form</strong> governs the style and behaviour of inputs
              and buttons — clean fields, a clear border that thickens on focus,
              validation, and disabling submit while invalid with a warning
              message. Use the <strong>slider</strong> for a value in a range, a
              {' '}<strong>radio group</strong> for one choice among a few visible
              options, and a <strong>toggle</strong> for a single on/off setting.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Why">
            <p className="component-demo__body">
              Centralising input behaviour means every form validates and gives
              feedback the same way, so people learn the rules once. Matching the
              control to the data — range, exclusive choice, binary — makes the
              right answer the obvious one and cuts input errors.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Best practices">
            <p className="component-demo__body">
              Always pair a control with a label. Prefer disabling submit with an
              inline reason over letting people fail blindly. Radios for two to
              about five visible options; a toggle only when the effect is
              immediate. Show validation on blur or submit, not on every keystroke.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Example">
            <p className="component-demo__body">
              A dosing form: a slider for mg/day, a radio group for route (oral /
              IV / topical), and a toggle for “include OTC drugs”. Submit stays
              disabled with “Enter a dose” until the slider is touched.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection n="10." title="Navigation & flow" lead="Side nav, tabs and steps — moving through the product.">
        <div className="guidance-grid">
          <GuidanceCard title="How to use it">
            <p className="component-demo__body">
              The <strong>side nav</strong> is top-level wayfinding — icons with
              labels, collapsible to icons only, hugging the screen edge.
              {' '}<strong>Tabs</strong> switch between peer views of the same
              context. <strong>Steps</strong> guide a linear wizard, showing where
              you are, where you've been and what's left.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Why">
            <p className="component-demo__body">
              Each answers a different “where am I?”. A persistent side nav anchors
              the whole app; tabs keep related views together without a page
              change; steps set expectations for a multi-stage task so it never
              feels open-ended.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Best practices">
            <p className="component-demo__body">
              Use the active colour's tint for the current side-nav item, not a
              neutral shade. Keep tab labels to a single word or two and use tabs
              only for genuine peers. Don't use steps for non-linear flows. The
              side nav scrolls the page back to the top on a change of view.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection n="11." title="Overlays" lead="Modal, drawer and tooltip — content above the page.">
        <div className="guidance-grid">
          <GuidanceCard title="How to use it">
            <p className="component-demo__body">
              A <strong>modal</strong> (native <code>&lt;dialog&gt;</code>, level
              4) blocks for a focused decision behind a grey scrim. A
              {' '}<strong>drawer</strong> is a large card sliding in from the
              right with a transparent curtain — for secondary detail you can
              dismiss. A <strong>tooltip</strong> (level 2) gives a brief,
              on-hover hint.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Why">
            <p className="component-demo__body">
              Overlays trade context for focus, so the more they interrupt the
              more they cost. Matching weight to importance — blocking modal,
              dismissible drawer, fleeting tooltip — keeps that cost proportional
              to what you're asking of the reader.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Best practices">
            <p className="component-demo__body">
              Reserve modals for decisions that must happen now; everything else
              is a drawer or inline. Both close on Escape and on a backdrop click,
              and animate in and out. Never put essential information in a
              tooltip — it's a hint, not a home for content.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection n="12." title="Feedback & status" lead="Alert, badge and loading bar — telling people what's happening.">
        <div className="guidance-grid">
          <GuidanceCard title="How to use it">
            <p className="component-demo__body">
              An <strong>alert</strong> carries a message with a status colour
              (info / success / warning / danger). A <strong>badge</strong> is a
              compact status label on an item — “Contraindicated”, “New”. The
              {' '}<strong>loading bar</strong> covers longer AI work, cycling
              status messages so the wait feels alive.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Why">
            <p className="component-demo__body">
              People need to know the system heard them, whether it worked, and
              whether to worry. Consistent status colour and placement let them
              read state pre-attentively — and a narrated loading bar turns dead
              time into reassurance during a slow analysis.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Best practices">
            <p className="component-demo__body">
              Match the status colour to severity and keep the message specific
              and actionable. Use badges for state, not decoration, and keep them
              to a word or two. Show the loading bar only for genuinely slow work,
              and write its messages to describe real progress.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection id="guidance-dataviz" n="13." title="Data visualisation" lead="Concentration curve and exposure bars — drug levels over time.">
        <div className="guidance-grid">
          <GuidanceCard title="How to use it">
            <p className="component-demo__body">
              The <strong>concentration–time curve</strong> is the primary view:
              blood level against time, with its key above the chart, and several
              drugs on shared axes for comparison. The <strong>exposure
              bars</strong> summarise a single metric — AUC (total exposure) or
              Cmax (the peak) — across those drugs.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Why">
            <p className="component-demo__body">
              Metabolism happens over time, so the curve is the honest shape of
              the data — area under it is exposure, its height is the peak. The
              bars then let people compare one metric across drugs at a glance,
              once the curve has given them the shape.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Best practices">
            <p className="component-demo__body">
              Pull series colours from the tokens via <code>useSeriesColors</code>
              {' '}so charts stay on-palette, and keep one consistent colour per
              drug across every chart. Always label axes and units. Lead with the
              curve for shape, then bars for comparison — don't ask a bar chart to
              show a time course.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection id="guidance-annotation" n="14." title="Diagram annotation" lead="Leader lines and labels that call out parts of a diagram.">
        <div className="guidance-grid">
          <GuidanceCard title="How to use it">
            <p className="component-demo__body">
              Wrap a diagram in <code>AnnotatedDiagram</code> and give each
              callout a target point in the diagram's own coordinates, a short
              title, an optional detail line and a tone. The component draws the
              marker, routes the leader and lays the label out for you — pushing
              it into the left or right gutter and spacing it clear of its
              neighbours. For a problem that needs attention, set{' '}
              <code>pulse</code> to ripple an amber (<code>warning</code>) or red
              (<code>danger</code>) wave out from its point.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Why">
            <p className="component-demo__body">
              An annotation is only useful if the eye can trace it from label to
              part without effort. Collecting labels into aligned gutters, keeping
              them from overlapping, and bending leaders at a single predictable
              45° angle turns a tangle of callouts into something scannable — the
              line should read as a quiet pointer, not compete with the diagram.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Best practices">
            <p className="component-demo__body">
              Prefer 45° elbows over curves — a consistent angle reads as
              deliberate and never hides which part it points to. Where the
              diagram allows, keep <strong>every label on the same side and
              aligned</strong> in one column: a shared edge scans far faster than
              callouts scattered around the figure. Keep labels{' '}
              <strong>outside the diagram's outline</strong>, never over it, so
              nothing obscures the part you're pointing at. Keep each label to a
              title plus a few words; don't cross leaders; and let the layout
              stack them rather than hand-placing. Use <strong>tone</strong> only
              for real meaning — <code>danger</code> for a risk, <code>primary</code>
              {' '}for the focus — and leave the rest neutral so emphasis stays
              honest.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>
    </>
  )
}

function Engineering() {
  return (
    <>
      <PageSection n="01." title="Getting started" lead="Consume the system in two imports.">
        <div className="guidance-grid">
          <GuidanceCard title="Install & import">
            <p className="component-demo__body">
              Import the tokens once near your app root; pull in components as you
              need them — each ships its own CSS.
            </p>
            <pre
              className="component-demo__panel"
              style={{ margin: 0, overflowX: 'auto', fontFamily: 'var(--font-mono)' }}
            >
              <code>{`import '@anbaric/design-system/tokens.css'
import { Button } from '@anbaric/design-system/components/Button'`}</code>
            </pre>
          </GuidanceCard>
          <GuidanceCard title="Ships as source">
            <p className="component-demo__body">
              Components ship as <code>.tsx</code> + <code>.css</code>; your
              bundler compiles them. A build emitting JS and types is on the
              roadmap.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection n="02." title="Foundations in code" lead="Two rules that keep the codebase coherent.">
        <div className="guidance-grid">
          <GuidanceCard title="Tokens first">
            <p className="component-demo__body">
              Never hardcode colour, spacing or radius — reference a token
              (<code>var(--color-…)</code>, <code>var(--space-…)</code>). One
              change flows everywhere, and theming stays possible.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Compose, don't fork">
            <p className="component-demo__body">
              Build screens from these components. Need a variant? Extend via
              props or a token before forking styles — divergence is what kills a
              system.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection n="03." title="Component conventions" lead="How a component is built.">
        <div className="guidance-grid">
          <GuidanceCard title="Anatomy">
            <p className="component-demo__body">
              One folder per component — <code>&lt;Name&gt;.tsx</code>,{' '}
              <code>&lt;Name&gt;.css</code>, <code>index.ts</code> — exported from{' '}
              <code>package.json</code> and shown in this preview (the living
              spec).
            </p>
          </GuidanceCard>
          <GuidanceCard title="Naming">
            <p className="component-demo__body">
              Class names are <code>.ds-</code>-prefixed and BEM-ish:{' '}
              <code>.ds-card</code>, <code>.ds-card__meta</code>,{' '}
              <code>.ds-button--ghost</code>. No global selectors.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Controlled or uncontrolled">
            <p className="component-demo__body">
              Inputs take <code>value</code> (controlled) or{' '}
              <code>defaultValue</code> (uncontrolled) with an{' '}
              <code>onChange</code> — the same pattern across Slider, RadioGroup,
              Toggle, Tabs and SideNav.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Styling">
            <p className="component-demo__body">
              Each component ships its own token-driven CSS. Private, single-use
              values take a leading underscore
              (<code>--_card-frame-gradient</code>) and stay out of the public
              tokens.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection n="04." title="Accessibility" lead="Built in, not bolted on.">
        <div className="guidance-grid">
          <GuidanceCard title="Native elements first">
            <p className="component-demo__body">
              Lean on the platform: <code>&lt;dialog&gt;</code> for Modal and
              Drawer, the Popover API for menus, native checkbox/radio under
              Toggle and RadioGroup. You inherit focus traps, light-dismiss and
              keyboard for free.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Roles & keyboard">
            <p className="component-demo__body">
              Interactive components carry the right roles and key handling — Tabs
              (arrow / Home / End), OptionsMenu, SideNav. Keep them when you
              compose.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Visible focus">
            <p className="component-demo__body">
              Every control shows a chunky focus ring (the primary tint). Never
              remove an outline without replacing it.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Motion & contrast">
            <p className="component-demo__body">
              Animations honour <code>prefers-reduced-motion</code>; check text
              contrast when placing foreground on a tinted or coloured surface.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection n="05." title="Modern CSS & support" lead="The platform features we rely on, and how they degrade.">
        <div className="guidance-grid">
          <GuidanceCard title="Features in use">
            <p className="component-demo__body">
              Popover API; <code>@starting-style</code> with{' '}
              <code>allow-discrete</code> for dialog animation;{' '}
              <code>color-mix()</code>; <code>:has()</code>;{' '}
              <code>backdrop-filter</code>; and CSS masks for the card frame.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Graceful degradation">
            <p className="component-demo__body">
              Targets current evergreen browsers. Where a feature is missing the
              effect simply drops — animations skip, the masked frame falls back
              to a plain border — never the functionality.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>

      <PageSection n="06." title="Performance & distribution" lead="Keep it lean as it grows.">
        <div className="guidance-grid">
          <GuidanceCard title="Bundle awareness">
            <p className="component-demo__body">
              Most components are tiny. The data-vis charts pull in Recharts
              (heavy) — lazy-load that section if bundle size matters.
            </p>
          </GuidanceCard>
          <GuidanceCard title="Roadmap">
            <p className="component-demo__body">
              Self-host the fonts (drop the Google Fonts CDN), and add a build
              that emits JS + <code>.d.ts</code>, pointing <code>exports</code> at{' '}
              <code>dist/</code> once the API settles.
            </p>
          </GuidanceCard>
        </div>
      </PageSection>
    </>
  )
}

/* -------------------------------------------------------------------- App -- */
const NAV = [
  { label: 'Foundations', value: 'foundations', icon: <Sym name="palette" /> },
  { label: 'Components', value: 'components', icon: <Sym name="widgets" /> },
  { label: 'Guidance', value: 'guidance', icon: <Sym name="menu_book" /> },
  { label: 'Engineering', value: 'engineering', icon: <Sym name="code" /> },
]

function App() {
  const [view, setView] = useState('foundations')
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null)

  // Switch view, then scroll to a section once the new view has rendered.
  const navigate = (nextView: string, anchor?: string) => {
    setView(nextView)
    setPendingAnchor(anchor ?? null)
  }

  useEffect(() => {
    if (!pendingAnchor) return
    document
      .getElementById(pendingAnchor)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setPendingAnchor(null)
  }, [view, pendingAnchor])

  return (
    <NavContext.Provider value={navigate}>
      <div
        className="app"
        style={{ ['--nav-w']: navCollapsed ? '4.25rem' : '14rem' } as CSSProperties}
      >
        <AppNav
          items={NAV}
          active={view}
          onChange={setView}
          account={{
            name: 'Ada Lovelace',
            subtitle: 'ada@anbaric.ai',
            items: [{ label: 'Profile' }, { label: 'Settings' }, { label: 'Sign out' }],
          }}
          collapsed={navCollapsed}
          onCollapsedChange={setNavCollapsed}
        />
        <main className="app__content">
          {view === 'foundations' ? <Foundations /> : null}
          {view === 'components' ? <Components /> : null}
          {view === 'guidance' ? <Guidance /> : null}
          {view === 'engineering' ? <Engineering /> : null}
        </main>
      </div>
    </NavContext.Provider>
  )
}

/* -------------------------------------------------------------- Mounting -- */
const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
