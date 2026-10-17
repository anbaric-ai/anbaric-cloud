import { useEffect, useState, type CSSProperties } from 'react'

import { Alert } from '@anbaric/design-system/components/Alert'
import { Badge } from '@anbaric/design-system/components/Badge'
import { Card } from '@anbaric/design-system/components/Card'
import { Skeleton } from '@anbaric/design-system/components/Skeleton'

import { PageShell } from './PageShell'

type TenantStatus = 'none' | 'subscribing' | 'provisioning' | 'active' | 'failed'

type ChoosableTenant = {
  slug: string | null
  name: string
  role: string
  status: TenantStatus
  personal: boolean
}

const muted: CSSProperties = { color: 'var(--color-foreground-tint-2)' }

const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-md)',
  width: '100%',
  padding: 'var(--space-md) var(--space-sm)',
  textAlign: 'left',
  font: 'inherit',
  color: 'var(--color-foreground)',
  background: 'transparent',
  border: 'none',
  borderTop: 'var(--border-hairline)',
  cursor: 'pointer',
}

const name: CSSProperties = {
  fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
  fontSize: 'var(--text-md)',
  lineHeight: 1.2,
}

const choices: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
  gap: 'var(--space-md)',
}

const choice: CSSProperties = {
  ...row,
  borderTop: 'none',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 'var(--space-sm)',
  padding: 'var(--space-sm)',
  minHeight: '9rem',
}

const choiceIcon: CSSProperties = { fontSize: '2rem', color: 'var(--color-primary)' }

const Icon = ({ name: glyph }: { name: string }) => (
  <span className="material-symbols-rounded" aria-hidden="true" style={choiceIcon}>{glyph}</span>
)

// What picking this tenant will do, said plainly: an unprovisioned one takes
// the person into the subscription journey rather than to a console.
const explain = (tenant: ChoosableTenant) => {
  if (tenant.status === 'active') return tenant.personal ? 'Your own environment' : `You are a ${tenant.role.toLowerCase()} here`
  if (tenant.status === 'none') return 'Not set up yet — choose a plan'
  if (tenant.status === 'failed') return "Something went wrong setting this up"
  return 'Still being set up'
}

// Someone with nothing yet: no tenant of their own and no invitation taken up.
const newcomer = (tenants: ChoosableTenant[]) =>
  tenants.length === 1 && tenants[0].personal && tenants[0].status === 'none'

const signOut = (
  <p style={{ ...muted, fontSize: 'var(--text-sm)', marginTop: 'var(--space-md)' }}>
    Not you? <a href="/logout" style={{ color: 'inherit' }}>Sign out</a>.
  </p>
)

function ChooseTenantPage() {
  const [tenants, setTenants] = useState<ChoosableTenant[] | undefined>(undefined)
  const [email, setEmail] = useState<string | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | undefined>(undefined)
  const [waitingToBeInvited, setWaitingToBeInvited] = useState(false)

  useEffect(() => {
    let live = true
    void fetch('/tenants/mine')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('mine'))))
      .then((mine: ChoosableTenant[]) => { if (live) setTenants(mine) })
      .catch(() => { if (live) setFailed(true) })
    void fetch('/whoami')
      .then((response) => (response.ok ? response.json() : undefined))
      .then((who?: { email?: string }) => { if (live && who?.email) setEmail(who.email) })
      .catch(() => undefined)
    return () => { live = false }
  }, [])

  const choose = async (tenant: ChoosableTenant) => {
    setBusy(tenant.slug ?? 'personal')
    try {
      const response = await fetch('/choose-tenant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: tenant.slug }),
      })
      const body = await response.json().catch(() => ({}))
      // A tenant with no cluster behind it yet means the subscription journey;
      // an active one means its console, which the routing cookie now reaches.
      window.location.assign(body?.status === 'active' ? '/' : '/subscribe')
    } catch {
      setBusy(undefined)
      setFailed(true)
    }
  }

  if (failed) {
    return (
      <PageShell title="Choose a tenant">
        <Alert variant="danger" title="Couldn't load your tenants">Try refreshing the page.</Alert>
      </PageShell>
    )
  }

  /* Until the list is here this page does not know whether it is the picker
     or the welcome, so it shows neither: just the mark, and no heading that a
     moment later turns into a different one. */
  if (!tenants) {
    return (
      <PageShell title="Anbaric" quiet logoHeight="9rem">
        <Skeleton lines={3} />
      </PageShell>
    )
  }

  /* A first visit with nowhere to go yet. Two kinds of person arrive here:
     one about to set up their own environment, and one who was told to sign
     in so that somebody else could let them into an app. The second has
     nothing to do but wait, and should be told so rather than offered a plan. */
  if (newcomer(tenants) && waitingToBeInvited) {
    return (
      <PageShell title="Anbaric" quiet logoHeight="9rem" width="36rem">
        <Card>
          <p style={{ margin: 0 }}>Your account has been created successfully.</p>
          <p style={{ margin: 'var(--space-md) 0 0', ...muted }}>
            If someone is trying to give you access to one of their Anbaric apps, they can invite you from their
            Anbaric account using the email address you just signed in with{email ? <>: <strong>{email}</strong></> : null}.
            Their invitation will bring you straight to the app.
          </p>
          <p style={{ margin: 'var(--space-md) 0 0', fontSize: 'var(--text-sm)' }}>
            <button type="button" style={{ ...row, borderTop: 'none', width: 'auto', padding: 0, ...muted, textDecoration: 'underline' }} onClick={() => setWaitingToBeInvited(false)}>
              Actually, I want to build apps
            </button>
          </p>
        </Card>
        {signOut}
      </PageShell>
    )
  }

  if (newcomer(tenants)) {
    return (
      <PageShell title="Anbaric" quiet logoHeight="9rem" width="40rem">
        <p style={{ ...muted, margin: '0 0 var(--space-md)' }}>Are you here to…</p>
        <div style={choices}>
          <Card interactive>
            <button type="button" style={choice} disabled={busy !== undefined} onClick={() => void choose(tenants[0])}>
              <Icon name="construction" />
              <span style={{ ...name, fontSize: 'var(--text-lg)' }}>Build apps</span>
              <span style={{ fontSize: 'var(--text-sm)', ...muted }}>
                Set up your own Anbaric environment and deploy your first app.
              </span>
            </button>
          </Card>
          <Card interactive>
            <button type="button" style={choice} disabled={busy !== undefined} onClick={() => setWaitingToBeInvited(true)}>
              <Icon name="mail" />
              <span style={{ ...name, fontSize: 'var(--text-lg)' }}>Use someone else's app</span>
              <span style={{ fontSize: 'var(--text-sm)', ...muted }}>
                Someone is trying to give me access to their app.
              </span>
            </button>
          </Card>
        </div>
        {signOut}
      </PageShell>
    )
  }

  return (
    <PageShell title="Choose a tenant">
      <div style={{ display: 'flex', flexDirection: 'column', borderBottom: 'var(--border-hairline)' }}>
          {tenants.map((tenant) => (
            <button
              key={tenant.slug ?? 'personal'}
              style={{ ...row, opacity: busy && busy !== (tenant.slug ?? 'personal') ? 0.5 : 1 }}
              disabled={busy !== undefined}
              onClick={() => void choose(tenant)}
            >
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                <span style={{ display: 'block', ...name }}>{tenant.name}</span>
                <span style={{ display: 'block', fontSize: 'var(--text-sm)', ...muted }}>{explain(tenant)}</span>
              </span>
              {tenant.personal ? <Badge tone="outline">Personal</Badge> : null}
              {tenant.status === 'active' ? null : <Badge tone="warning">Setup</Badge>}
            </button>
          ))}
      </div>
      <p style={{ ...muted, fontSize: 'var(--text-sm)', marginTop: 'var(--space-md)' }}>
        You can switch tenant any time from your account menu.
        {' '}Not you? <a href="/logout" style={{ color: 'inherit' }}>Sign out</a>.
      </p>
    </PageShell>
  )
}

export { ChooseTenantPage }
