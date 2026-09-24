import { useEffect, useState, type CSSProperties } from 'react'

import { Card } from '@anbaric/design-system/components/Card'
import { LoadingBar } from '@anbaric/design-system/components/LoadingBar'
import { Steps } from '@anbaric/design-system/components/Steps'

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

const PATIENCE_LIMIT_MS = 10 * 60_000

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

const note: CSSProperties = {
  margin: 'var(--space-lg) 0 0',
  color: 'var(--color-foreground-tint-2)',
  fontSize: '0.85rem',
  fontVariantNumeric: 'tabular-nums',
}

const since = (from: number) => {
  const seconds = Math.floor((Date.now() - from) / 1000)
  return seconds < 60 ? `${seconds} seconds` : `${Math.floor(seconds / 60)} minutes`
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
  const patient = Date.now() - startedAt > PATIENCE_LIMIT_MS

  return (
    <Card>
      <h2 style={heading}>{failed ? 'We hit a snag' : 'Setting up your Anbaric environment'}</h2>
      <p style={lead}>{message}</p>

      {failed ? null : <LoadingBar messages={[]} />}

      {failed || stages.length === 0 ? null : (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <Steps steps={stages.map((key) => WORDS[key] ?? 'Working on it')} current={Math.max(reached, 0)} />
        </div>
      )}

      {failed || waiting <= PATIENCE_MS ? null : (
        <p style={note}>
          {patient
            ? 'Still working. This one is taking longer than usual, but nothing has gone wrong.'
            : `This step has been running for ${since(stageAt)}.`}
        </p>
      )}
    </Card>
  )
}

export { ProvisioningPage }
