import { useEffect, useState, type CSSProperties } from 'react'

import { Badge } from '@anbaric/design-system/components/Badge'
import { Card } from '@anbaric/design-system/components/Card'

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
  padding: 'var(--space-md)',
  textAlign: 'left',
  font: 'inherit',
  color: 'var(--color-foreground)',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-element)',
  cursor: 'pointer',
}

const name: CSSProperties = {
  fontFamily: 'var(--font-title)',
  fontSize: '1rem',
  lineHeight: 1.1,
}

// What picking this tenant will do, said plainly: an unprovisioned one takes
// the person into the subscription journey rather than to a console.
const explain = (tenant: ChoosableTenant) => {
  if (tenant.status === 'active') return tenant.personal ? 'Your own environment' : `You are a ${tenant.role.toLowerCase()} here`
  if (tenant.status === 'none') return 'Not set up yet — choose a plan'
  if (tenant.status === 'failed') return "Something went wrong setting this up"
  return 'Still being set up'
}

function ChooseTenantPage() {
  const [tenants, setTenants] = useState<ChoosableTenant[] | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | undefined>(undefined)

  useEffect(() => {
    let live = true
    void fetch('/tenants/mine')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('mine'))))
      .then((mine: ChoosableTenant[]) => { if (live) setTenants(mine) })
      .catch(() => { if (live) setFailed(true) })
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
        <Card><p style={{ margin: 0, ...muted }}>Couldn't load your tenants. Try refreshing.</p></Card>
      </PageShell>
    )
  }

  if (!tenants) {
    return (
      <PageShell title="Choose a tenant">
        <Card><p style={{ margin: 0, ...muted }}>Loading…</p></Card>
      </PageShell>
    )
  }

  return (
    <PageShell title="Choose a tenant">
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {tenants.map((tenant) => (
            <button
              key={tenant.slug ?? 'personal'}
              style={{ ...row, opacity: busy && busy !== (tenant.slug ?? 'personal') ? 0.5 : 1 }}
              disabled={busy !== undefined}
              onClick={() => void choose(tenant)}
            >
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                <span style={{ display: 'block', ...name }}>{tenant.name}</span>
                <span style={{ display: 'block', fontSize: '0.8rem', ...muted }}>{explain(tenant)}</span>
              </span>
              {tenant.personal ? <Badge tone="neutral">Personal</Badge> : null}
              {tenant.status === 'active' ? null : <Badge tone="warning">Setup</Badge>}
            </button>
          ))}
        </div>
      </Card>
      <p style={{ ...muted, fontSize: '0.8rem', marginTop: 'var(--space-md)' }}>
        You can switch tenant any time from your account menu.
      </p>
    </PageShell>
  )
}

export { ChooseTenantPage }
