import { useEffect, useState, type CSSProperties } from 'react'

import { Card } from '@anbaric/design-system/components/Card'
import { LoadingBar } from '@anbaric/design-system/components/LoadingBar'

// Deliberately non-specific, reassuring language - a "train of thought" rather
// than raw infrastructure steps ("Preparing your database", not "Creating an
// RDS instance"). The keys come from the provisioner, which reports what it is
// actually doing; the words live here so the two can change apart.
const WORDS: Record<string, string> = {
  queued: 'Setting up your account',
  network: 'Securing your private network',
  database: 'Preparing your database',
  platform: 'Building your platform',
  starting: 'Starting your environment',
  checks: 'Running the final checks',
}

// A stage that runs longer than this gets a running time beside it. Silence on
// a slow step reads as a hang, and saying how long it has been is kinder than
// a spinner that could mean anything.
const PATIENCE_MS = 45_000

const heading: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-title)',
  fontSize: '1.15rem',
  textTransform: 'var(--title-transform)' as CSSProperties['textTransform'],
}

const lead: CSSProperties = {
  margin: 'var(--space-xs) 0 var(--space-lg)',
  color: 'var(--color-foreground-tint-2)',
  fontSize: '0.9rem',
}

const log: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
  marginTop: 'var(--space-lg)',
}

const thought = (state: 'done' | 'current' | 'upcoming'): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  fontSize: '0.9rem',
  color: state === 'upcoming' ? 'var(--color-foreground-tint-3, var(--color-foreground-tint-2))'
    : state === 'done' ? 'var(--color-foreground-tint-2)' : 'var(--color-foreground)',
  opacity: state === 'upcoming' ? 0.5 : 1,
  transition: 'opacity var(--duration-medium, 200ms) ease',
})

const dot = (state: 'done' | 'current' | 'upcoming'): CSSProperties => ({
  width: '0.55rem',
  height: '0.55rem',
  borderRadius: '50%',
  flex: '0 0 auto',
  background: state === 'upcoming' ? 'var(--color-foreground-tint-3, var(--color-foreground-tint-2))'
    : state === 'done' ? 'var(--color-success, var(--color-primary))' : 'var(--color-primary)',
  boxShadow: state === 'current' ? '0 0 0 0.2rem color-mix(in srgb, var(--color-primary) 25%, transparent)' : 'none',
  animation: state === 'current' ? 'ds-pulse 1.2s ease-in-out infinite' : 'none',
})

const elapsed: CSSProperties = {
  marginLeft: 'auto',
  fontSize: '0.8rem',
  color: 'var(--color-foreground-tint-2)',
  fontVariantNumeric: 'tabular-nums',
}

const since = (from: number) => {
  const seconds = Math.floor((Date.now() - from) / 1000)
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

type Props = {
  message: string
  failed?: boolean
  stages?: Array<string>
  stage?: string
}

function ProvisioningPage({ message, failed = false, stages = [], stage }: Props) {
  const [, tick] = useState(0)
  const [startedAt] = useState(() => Date.now())
  const [stageAt, setStageAt] = useState(() => Date.now())

  useEffect(() => setStageAt(Date.now()), [stage])

  useEffect(() => {
    if (failed) return
    const timer = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [failed])

  const reached = stage ? stages.indexOf(stage) : -1
  const waiting = Date.now() - stageAt
  const patient = Date.now() - startedAt > 10 * 60_000

  return (
    <Card>
      <style>{'@keyframes ds-pulse{0%,100%{opacity:1}50%{opacity:0.35}}'}</style>
      <h2 style={heading}>{failed ? 'We hit a snag' : 'Setting up your Anbaric environment'}</h2>
      <p style={lead}>{message}</p>

      {failed ? null : <LoadingBar messages={[]} />}

      {failed || stages.length === 0 ? null : (
        <div style={log}>
          {stages.map((key, index) => {
            const state = index < reached ? 'done' : index === reached ? 'current' : 'upcoming'
            return (
              <div key={key} style={thought(state)}>
                <span style={dot(state)} aria-hidden="true" />
                {WORDS[key] ?? 'Working on it'}
                {state === 'current' && waiting > PATIENCE_MS ? <span style={elapsed}>{since(stageAt)}</span> : null}
              </div>
            )
          })}
        </div>
      )}

      {failed || !patient ? null : (
        <p style={{ ...lead, margin: 'var(--space-lg) 0 0' }}>
          Still working. This one is taking longer than usual, but nothing has gone wrong.
        </p>
      )}
    </Card>
  )
}

export { ProvisioningPage }
