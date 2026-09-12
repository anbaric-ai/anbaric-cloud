import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { Badge } from '@anbaric/design-system/components/Badge'
import { Button } from '@anbaric/design-system/components/Button'
import { Card } from '@anbaric/design-system/components/Card'
import { LoadingBar } from '@anbaric/design-system/components/LoadingBar'

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
// Only surface a load error if we never managed a first read - a blip mid-
// provisioning must not replace the progress screen with an error.
const INITIAL_FAIL_LIMIT = 5

const grid: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', alignItems: 'stretch' }
const tile: CSSProperties = { flex: '1 1 16rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }
const price: CSSProperties = { fontFamily: 'var(--font-title)', fontSize: '2rem', margin: 0 }
const perMonth: CSSProperties = { color: 'var(--color-foreground-tint-2)', fontSize: '0.9rem' }
const muted: CSSProperties = { color: 'var(--color-foreground-tint-2)' }
const subtle: CSSProperties = { ...muted, fontSize: '0.8rem', marginTop: 'var(--space-md)' }
const heading: CSSProperties = {
  margin: '0 0 var(--space-lg)',
  fontFamily: 'var(--font-title)',
  textTransform: 'var(--title-transform)' as CSSProperties['textTransform'],
}

function SubscribePage({ requestId }: { requestId?: string }) {
  const [data, setData] = useState<Status | undefined>(undefined)
  const [failedLoads, setFailedLoads] = useState(0)
  const [redirecting, setRedirecting] = useState(false)
  const [busy, setBusy] = useState<Plan | undefined>(undefined)
  const approved = useRef(false)
  const redirectingRef = useRef(false)
  redirectingRef.current = redirecting

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
    let timer: ReturnType<typeof setInterval> | undefined

    const poll = async () => {
      if (redirectingRef.current) return
      try {
        const response = await fetch('/subscribe/status')
        if (!response.ok) throw new Error('status')
        const status: Status = await response.json()
        if (!live) return
        setData(status)
        setFailedLoads(0)
        if (status.status === 'active') {
          void autoApprove()
          if (timer) clearInterval(timer)
        }
      } catch {
        if (live) setFailedLoads((n) => n + 1)
      }
    }

    void poll()
    timer = setInterval(poll, POLL_MS)
    return () => {
      live = false
      if (timer) clearInterval(timer)
    }
  }, [])

  const choose = async (plan: Plan) => {
    setBusy(plan)
    setRedirecting(true)
    try {
      const response = await fetch('/subscribe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan, returnTo: window.location.pathname }),
      })
      const body = await response.json()
      if (body?.url) {
        window.location.assign(body.url)
        return
      }
    } catch {
      // fall through to reset
    }
    setRedirecting(false)
    setBusy(undefined)
  }

  // Once a plan is chosen we are navigating to Stripe: show only the redirect
  // notice so the progress screen never flashes in the gap before navigation.
  if (redirecting) {
    return (
      <PageShell title="One moment">
        <Card>
          <p style={{ margin: '0 0 var(--space-md)', ...muted }}>Taking you to secure checkout…</p>
          <LoadingBar messages={[]} />
        </Card>
      </PageShell>
    )
  }

  if (!data) {
    if (failedLoads >= INITIAL_FAIL_LIMIT) {
      return <PageShell title="Get started"><Card><p style={{ margin: 0, ...muted }}>Couldn't load your subscription. Try refreshing.</p></Card></PageShell>
    }
    return <PageShell title="Get started"><Card><p style={{ margin: 0, ...muted }}>Loading…</p></Card></PageShell>
  }

  if (data.status === 'active') {
    return (
      <PageShell title="You're all set">
        <Card>
          <h2 style={heading}>Your environment is ready</h2>
          <p style={{ margin: 0 }}>
            {requestId
              ? 'Return to your terminal — the CLI will continue automatically.'
              : 'You can head back to your terminal and deploy.'}
          </p>
        </Card>
      </PageShell>
    )
  }

  if (data.status === 'subscribing' || data.status === 'provisioning') {
    return (
      <PageShell title="Setting things up">
        <ProvisioningPage message="This usually takes a few minutes. You can keep this tab open — it updates itself." />
      </PageShell>
    )
  }

  if (data.status === 'failed') {
    return (
      <PageShell title="Setting things up">
        <ProvisioningPage failed message="Something went wrong setting up your environment. Please contact support and we'll sort it out." />
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
                {data.prices[plan].display}
                <span style={perMonth}> /month</span>
              </p>
              <p style={{ margin: 0 }}>{blurb}</p>
              <Button variant="primary" fullWidth loading={busy === plan} disabled={busy !== undefined} onClick={() => choose(plan)}>
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
