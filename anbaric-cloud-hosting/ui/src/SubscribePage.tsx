import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { Badge } from '@anbaric/design-system/components/Badge'
import { Button } from '@anbaric/design-system/components/Button'
import { Card } from '@anbaric/design-system/components/Card'

import { PageShell } from './PageShell'
import { ProvisioningPage } from './ProvisioningPage'

type Plan = 'solo' | 'team'
type PlanPrice = { amount: number; display: string }
type Status = {
  status: 'none' | 'subscribing' | 'provisioning' | 'active' | 'failed'
  slug: string
  prices: Record<Plan, PlanPrice>
}

const PLANS: Array<{ plan: Plan; name: string; blurb: string }> = [
  { plan: 'solo', name: 'Solo', blurb: 'A single user, up to 10 live apps.' },
  { plan: 'team', name: 'Team', blurb: 'Up to 10 users, up to 50 apps.' },
]

const POLL_MS = 3000

const grid: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-md)',
  alignItems: 'stretch',
}

const tile: CSSProperties = {
  flex: '1 1 16rem',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
}

const price: CSSProperties = {
  fontFamily: 'var(--font-title)',
  fontSize: '2rem',
  margin: 0,
}

const perMonth: CSSProperties = { color: 'var(--color-foreground-tint-2)', fontSize: '0.9rem' }

const subtle: CSSProperties = {
  color: 'var(--color-foreground-tint-2)',
  fontSize: '0.8rem',
  marginTop: 'var(--space-md)',
}

const stepFor = (status: Status['status']): number =>
  status === 'active' ? 3 : status === 'none' ? 0 : 2

function SubscribePage({ requestId }: { requestId?: string }) {
  const [state, setState] = useState<Status | 'loading' | 'error'>('loading')
  const [busy, setBusy] = useState<Plan | undefined>(undefined)
  const approved = useRef(false)

  const autoApprove = async () => {
    if (!requestId || approved.current) return
    approved.current = true
    await fetch(`/authorize-cli/${encodeURIComponent(requestId)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientName: 'Anbaric CLI' }),
    }).catch(() => {})
  }

  useEffect(() => {
    let live = true

    const poll = async () => {
      try {
        const response = await fetch('/subscribe/status')
        if (!response.ok) return live && setState('error')
        const status: Status = await response.json()
        if (!live) return
        if (status.status === 'active') void autoApprove()
        setState(status)
      } catch {
        if (live) setState('error')
      }
    }

    void poll()
    const timer = setInterval(poll, POLL_MS)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [])

  const choose = async (plan: Plan) => {
    setBusy(plan)
    try {
      const response = await fetch('/subscribe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan, returnTo: window.location.pathname }),
      })
      const body = await response.json()
      if (body?.url) window.location.assign(body.url)
      else setBusy(undefined)
    } catch {
      setBusy(undefined)
    }
  }

  if (state === 'loading') {
    return <PageShell title="Get started"><Card><p style={{ margin: 0, ...perMonth }}>Loading…</p></Card></PageShell>
  }
  if (state === 'error') {
    return (
      <PageShell title="Get started">
        <Card><p style={{ margin: 0, ...perMonth }}>Couldn't load your subscription. Try refreshing.</p></Card>
      </PageShell>
    )
  }

  if (state.status === 'active') {
    return (
      <PageShell title="You're all set">
        <ProvisioningPage
          current={3}
          message={requestId
            ? 'Your Anbaric environment is ready. Return to your terminal — the CLI will continue automatically.'
            : 'Your Anbaric environment is ready.'}
        />
      </PageShell>
    )
  }

  if (state.status === 'subscribing' || state.status === 'provisioning') {
    return (
      <PageShell title="Setting things up">
        <ProvisioningPage current={2} message="Provisioning your Anbaric environment. This takes a few minutes — you can keep this tab open." />
      </PageShell>
    )
  }

  if (state.status === 'failed') {
    return (
      <PageShell title="Setting things up">
        <ProvisioningPage current={2} failed message="Something went wrong provisioning your environment. Please contact support." />
      </PageShell>
    )
  }

  return (
    <PageShell title="Choose a plan">
      <div style={grid}>
        {PLANS.map(({ plan, name, blurb }) => (
          <Card key={plan}>
            <div style={tile}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-title)' }}>{name}</h2>
                <Badge tone="primary">First month free</Badge>
              </div>
              <p style={price}>
                {state.prices[plan].display}
                <span style={perMonth}> /month</span>
              </p>
              <p style={{ margin: 0 }}>{blurb}</p>
              <Button
                variant="primary"
                fullWidth
                loading={busy === plan}
                disabled={busy !== undefined}
                onClick={() => choose(plan)}
              >
                Start free month
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <p style={subtle}>You can add more apps to any plan later.</p>
    </PageShell>
  )
}

export { SubscribePage }
