import { useEffect, useState, type CSSProperties } from 'react'

import { Card } from '@anbaric/design-system/components/Card'
import { LoadingBar } from '@anbaric/design-system/components/LoadingBar'

// Deliberately non-specific, reassuring language - a "train of thought" rather
// than raw infrastructure steps ("Creating your network", not "Provisioning a VPC").
const THOUGHTS = [
  'Setting up your account',
  'Creating your private network',
  'Preparing your database',
  'Building your platform',
  'Wiring up secure access',
  'Starting your environment',
  'Running the final checks',
]

const REVEAL_MS = 3500

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

const dot = (state: 'done' | 'current'): CSSProperties => ({
  width: '0.55rem',
  height: '0.55rem',
  borderRadius: '50%',
  flex: '0 0 auto',
  background: state === 'done' ? 'var(--color-success, var(--color-primary))' : 'var(--color-primary)',
  boxShadow: state === 'current' ? '0 0 0 0.2rem color-mix(in srgb, var(--color-primary) 25%, transparent)' : 'none',
  animation: state === 'current' ? 'ds-pulse 1.2s ease-in-out infinite' : 'none',
})

function ProvisioningPage({ message, failed = false }: { message: string; failed?: boolean }) {
  const [revealed, setRevealed] = useState(1)

  useEffect(() => {
    if (failed) return
    const timer = setInterval(() => setRevealed((n) => Math.min(n + 1, THOUGHTS.length)), REVEAL_MS)
    return () => clearInterval(timer)
  }, [failed])

  return (
    <Card>
      <style>{'@keyframes ds-pulse{0%,100%{opacity:1}50%{opacity:0.35}}'}</style>
      <h2 style={heading}>{failed ? 'We hit a snag' : 'Setting up your Anbaric environment'}</h2>
      <p style={lead}>{message}</p>

      {failed ? null : <LoadingBar messages={[]} />}

      {failed ? null : (
        <div style={log}>
          {THOUGHTS.slice(0, revealed).map((line, i) => {
            const state = i < revealed - 1 ? 'done' : 'current'
            return (
              <div key={line} style={thought(state)}>
                <span style={dot(state)} aria-hidden="true" />
                {line}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export { ProvisioningPage }
