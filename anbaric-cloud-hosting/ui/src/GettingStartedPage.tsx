import { type CSSProperties, type ReactNode } from 'react'

import { Card } from '@anbaric/design-system/components/Card'
import { Section } from '@anbaric/design-system/components/Section'

type Step = { title: string; body: ReactNode; command?: string }

type Path = { title: string; lead: string; steps: Step[] }

const muted: CSSProperties = { color: 'var(--color-foreground-tint-2)' }

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 19rem), 1fr))',
  gap: 'var(--space-lg)',
  alignItems: 'start',
}

const steps: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-md)',
  margin: 0,
  padding: 0,
  listStyle: 'none',
  counterReset: 'step',
}

const step: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.5rem 1fr',
  gap: 'var(--space-sm)',
  alignItems: 'start',
}

const number: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1.5rem',
  height: '1.5rem',
  borderRadius: '50%',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-primary)',
  background: 'color-mix(in srgb, var(--color-primary) 14%, var(--color-background))',
}

const stepTitle: CSSProperties = { margin: 0, fontFamily: 'var(--font-title)', fontSize: '0.95rem', lineHeight: 1.2 }

const command: CSSProperties = {
  margin: 'var(--space-sm) 0 0',
  padding: 'var(--space-sm) var(--space-md)',
  overflowX: 'auto',
  fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
  fontSize: '0.8rem',
  lineHeight: 1.5,
  color: 'var(--color-foreground)',
  background: 'var(--color-background-shade-1)',
  borderRadius: 'var(--radius-element)',
}

/* The same three paths as anbaric.ai/getting-started, with the commands as
   the CLI actually spells them. */
const PATHS: Path[] = [
  {
    title: 'Connect Claude Code',
    lead: 'Let Claude build and deploy the app for you.',
    steps: [
      {
        title: 'Add the Anbaric skill from the marketplace',
        body: "Install the Anbaric plugin from Claude Code's plugin marketplace.",
        command: '/plugin marketplace add anbaric-ai/anbaric-skill',
      },
      {
        title: 'Install the plugin',
        body: 'Install the Anbaric plugin into your Claude Code session.',
        command: '/plugin install anbaric@anbaric',
      },
      {
        title: 'Start building',
        body: 'Ask Claude Code to build and deploy an app. It will scaffold it, sign in to this tenant, and ship it.',
        command: '/anbaric build me a new crm',
      },
    ],
  },
  {
    title: "Use Anbaric's MCP server",
    lead: 'For any agent that speaks MCP.',
    steps: [
      {
        title: 'Clone the skill repository',
        body: 'The MCP server ships inside the Anbaric skill repository on GitHub.',
        command: 'git clone https://github.com/anbaric-ai/anbaric-skill',
      },
      {
        title: 'Register the server in your MCP config',
        body: 'Add the Anbaric server to your MCP client configuration, pointing at the cloned entry point.',
        command: '{\n  "mcpServers": {\n    "anbaric": {\n      "command": "node",\n      "args": ["/abs/path/anbaric-skill/plugins/anbaric/mcp/dist/index.js"]\n    }\n  }\n}',
      },
      {
        title: 'Install the CLI and sign in',
        body: 'The server deploys through the CLI, so install it and authorise this machine.',
        command: 'npm install -g anbaric-cli\nanbaric login',
      },
      {
        title: 'Sanity check',
        body: 'Ask your agent to run the anbaric_whoami tool. It should answer with this tenant.',
      },
    ],
  },
  {
    title: 'Manual setup',
    lead: 'Write the app yourself and deploy it from the terminal.',
    steps: [
      {
        title: 'Initialise a project',
        body: 'Scaffold a new Node project and add the Anbaric SDK as a dependency.',
        command: 'npm init -y\nnpm install anbaric',
      },
      {
        title: 'Install the CLI and sign in',
        body: 'Install the Anbaric CLI globally so you can deploy from any project, then authorise this machine.',
        command: 'npm install -g anbaric-cli\nanbaric login',
      },
      {
        title: 'Build your app',
        body: 'Write it however you like. Anbaric wraps any Node service, and the SDK gives you state machines, jobs and actors when you want them.',
      },
      {
        title: 'Deploy',
        body: 'Configure once, then deploy. The platform builds, provisions and serves the app at an address of its own, and this page gives way to your dashboard.',
        command: 'anbaric app configure\nanbaric app deploy',
      },
    ],
  },
]

/* What a tenant with nothing deployed sees in place of its dashboard: the
   three ways to get a first app here, as anbaric.ai describes them. Someone
   who subscribed on the web rather than from a deploy has otherwise reached
   an empty console with no clue what comes next. */
function GettingStartedPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <p style={{ margin: 0, maxWidth: '40rem', ...muted }}>
        Nothing is deployed here yet. Pick whichever path fits how you work; all three land an app on
        this tenant, where it is hosted behind sign-in, audited, and given an address of its own.
      </p>

      <div style={grid}>
        {PATHS.map((path) => (
          <Section key={path.title} title={path.title}>
            <Card>
              <p style={{ margin: '0 0 var(--space-md)', fontSize: '0.9rem', ...muted }}>{path.lead}</p>
              <ol style={steps}>
                {path.steps.map((each, index) => (
                  <li key={each.title} style={step}>
                    <span style={number} aria-hidden="true">{index + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={stepTitle}>{each.title}</h3>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.85rem', ...muted }}>{each.body}</p>
                      {each.command ? <pre style={command}>{each.command}</pre> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </Section>
        ))}
      </div>

      <p style={{ margin: 0, fontSize: '0.85rem', ...muted }}>
        The same guide lives at{' '}
        <a href="https://anbaric.ai/getting-started" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
          anbaric.ai/getting-started
        </a>
        , and the full CLI reference and SDK docs are{' '}
        <a href="https://github.com/anbaric-ai/anbaric-cloud/tree/main/anbaric/docs" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
          on GitHub
        </a>
        .
      </p>
    </div>
  )
}

export { GettingStartedPage }
