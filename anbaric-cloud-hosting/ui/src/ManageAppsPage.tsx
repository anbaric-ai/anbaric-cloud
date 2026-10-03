import { useEffect, useState, type CSSProperties } from 'react'

import { Alert } from '@anbaric/design-system/components/Alert'
import { Badge } from '@anbaric/design-system/components/Badge'
import { Button } from '@anbaric/design-system/components/Button'
import { Card } from '@anbaric/design-system/components/Card'
import { Modal } from '@anbaric/design-system/components/Modal'
import { Toggle } from '@anbaric/design-system/components/Toggle'
import { Tooltip } from '@anbaric/design-system/components/Tooltip'

import { appUrl, type CurrentUser } from './appUrl'

type AppSize = 'small' | 'large'

type ManagedApp = {
  appName: string
  status: string
  size?: AppSize
  subdomain?: string
  url?: string
  draining?: { inFlight: number; since: number }
}

// What each size costs a month, as the control plane quotes it in the
// tenant's currency. Absent on a platform with no control plane behind it.
type Pricing = { small: string; large: string }

const muted: CSSProperties = { color: 'var(--color-foreground-tint-2)' }

const rows: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }

const row: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--space-md)',
}

const actions: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-sm)',
  alignItems: 'center',
  marginLeft: 'auto',
}

const appTitle: CSSProperties = {
  fontFamily: 'var(--font-title)',
  fontSize: '1.125rem',
  lineHeight: 1.1,
  margin: 0,
}

const field: CSSProperties = {
  font: 'inherit',
  color: 'var(--color-foreground)',
  background: 'var(--color-background)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-element)',
  padding: 'var(--space-xs) var(--space-sm)',
  minWidth: '8rem',
  flex: '1 1 8rem',
}

const addressForm: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  flexWrap: 'wrap',
}

const sizeControl: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  fontSize: '0.85rem',
}

const infoIcon: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1.1rem',
  height: '1.1rem',
  borderRadius: '50%',
  border: '1px solid var(--color-foreground-tint-2)',
  fontSize: '0.7rem',
  fontFamily: 'var(--font-mono)',
  cursor: 'help',
  ...muted,
}

const LARGE_EXPLAINED = 'A large instance gets faster compute and 4× the RAM.'

const tone = (status: string) =>
  status === 'running' ? 'success' : status === 'failed' ? 'danger' : status === 'building' ? 'primary' : 'neutral'

/* What a builder can do to a deployed app from the console: move it to a
   different address, give it a bigger instance, or take it away. Deploying
   stays the CLI's job - this is for the things that have no other home. */
function ManageAppsPage() {
  const [apps, setApps] = useState<ManagedApp[] | undefined>(undefined)
  const [user, setUser] = useState<CurrentUser | undefined>(undefined)
  const [pricing, setPricing] = useState<Pricing | undefined>(undefined)
  const [problem, setProblem] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState<string | undefined>(undefined)
  const [changing, setChanging] = useState<ManagedApp | undefined>(undefined)
  const [wanted, setWanted] = useState('')
  const [addressProblem, setAddressProblem] = useState<string | undefined>(undefined)
  const [resizing, setResizing] = useState<{ app: ManagedApp; to: AppSize } | undefined>(undefined)
  const [removing, setRemoving] = useState<ManagedApp | undefined>(undefined)

  const load = async () => {
    try {
      const response = await fetch('/api/v2/apps')
      if (!response.ok) throw new Error('apps')
      setApps(await response.json())
    } catch {
      setProblem("Couldn't load your apps. Try refreshing.")
    }
  }

  useEffect(() => {
    void load()
    void fetch('/api/v2/whoami')
      .then((response) => (response.ok ? response.json() : undefined))
      .then((who: CurrentUser | undefined) => setUser(who))
      .catch(() => {})
    // Only a platform with a control plane has prices, or sizes worth offering.
    void fetch('/api/v2/billing/summary')
      .then((response) => (response.ok ? response.json() : undefined))
      .then((summary?: { perApp?: { display: string }; perLargeApp?: { display: string } }) => {
        if (summary?.perApp && summary.perLargeApp) setPricing({ small: summary.perApp.display, large: summary.perLargeApp.display })
      })
      .catch(() => {})
  }, [])

  const addressable = Boolean(user?.appHostSuffix)

  const openChange = (app: ManagedApp) => {
    setWanted(app.subdomain ?? app.appName)
    setAddressProblem(undefined)
    setChanging(app)
  }

  const saveAddress = async () => {
    if (!changing) return
    const label = wanted.trim().toLowerCase()
    if (!label || label === changing.subdomain) {
      setChanging(undefined)
      return
    }

    setBusy(changing.appName)
    setAddressProblem(undefined)
    try {
      const response = await fetch(`/api/v2/apps/${encodeURIComponent(changing.appName)}/subdomain`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subdomain: label }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error ?? 'That address is not available')

      setChanging(undefined)
      await load()
    } catch (error) {
      setAddressProblem(error instanceof Error ? error.message : 'That address is not available')
    } finally {
      setBusy(undefined)
    }
  }

  const resize = async () => {
    if (!resizing) return
    const { app, to } = resizing
    setResizing(undefined)
    setBusy(app.appName)
    setProblem(undefined)
    try {
      const response = await fetch(`/api/v2/apps/${encodeURIComponent(app.appName)}/size`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ size: to }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Could not change the size of that app')
      }
      await load()
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Could not change the size of that app')
    } finally {
      setBusy(undefined)
    }
  }

  const tearDown = async (app: ManagedApp) => {
    setBusy(app.appName)
    setProblem(undefined)
    setRemoving(undefined)
    try {
      const response = await fetch(`/api/v2/apps/${encodeURIComponent(app.appName)}`, { method: 'DELETE' })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Could not remove that app')
      }
      await load()
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Could not remove that app')
    } finally {
      setBusy(undefined)
    }
  }

  if (!apps) {
    return <Card><p style={{ margin: 0, ...muted }}>{problem ?? 'Loading…'}</p></Card>
  }

  const unchanged = wanted.trim().toLowerCase() === (changing?.subdomain ?? '')
  const priceOf = (size: AppSize) => pricing?.[size] ?? (size === 'large' ? '$50 / £50' : '$20 / £20')

  return (
    <div style={rows}>
      {problem ? <Alert variant="danger">{problem}</Alert> : null}

      {apps.length === 0 ? (
        <Card>
          <p style={{ margin: 0, ...muted }}>
            Nothing is deployed yet. Deploy an app with <code>anbaric app deploy</code>.
          </p>
        </Card>
      ) : null}

      {apps.map((app) => (
        <Card key={app.appName}>
          <div style={row}>
            <span style={{ minWidth: 0 }}>
              <h2 style={appTitle}>{app.appName}</h2>
              <span style={{ display: 'block', fontSize: '0.8rem', ...muted }}>
                {app.subdomain
                  ? <a href={appUrl(app)} style={{ color: 'inherit' }}>{app.subdomain}.{user?.appHostSuffix}</a>
                  : addressable ? 'No address yet' : `/app/${app.appName}`}
              </span>
            </span>

            <Badge tone={tone(app.status)}>{app.status}</Badge>

            <span style={actions}>
              {pricing ? (
                <span style={sizeControl}>
                  <Toggle
                    checked={app.size === 'large'}
                    disabled={busy !== undefined}
                    aria-label={`Large instance for ${app.appName}`}
                    onChange={(large) => setResizing({ app, to: large ? 'large' : 'small' })}
                    label={app.size === 'large' ? `Large · ${pricing.large}/mo` : `Small · ${pricing.small}/mo`}
                  />
                  <Tooltip label={LARGE_EXPLAINED}>
                    <span style={infoIcon} tabIndex={0} aria-label={LARGE_EXPLAINED}>i</span>
                  </Tooltip>
                </span>
              ) : null}
              {addressable ? (
                <Button variant="ghost" disabled={busy !== undefined} onClick={() => openChange(app)}>
                  Change URL
                </Button>
              ) : null}
              <Button variant="danger" disabled={busy !== undefined} onClick={() => setRemoving(app)}>
                Tear down
              </Button>
            </span>
          </div>

          {app.draining ? (
            <p style={{ margin: 'var(--space-sm) 0 0', fontSize: '0.8rem', ...muted }}>
              Draining: {app.draining.inFlight} step(s) still in flight.
            </p>
          ) : null}
        </Card>
      ))}

      <Modal
        open={changing !== undefined}
        onClose={() => setChanging(undefined)}
        title={`Change the URL of ${changing?.appName ?? ''}`}
      >
        <form
          style={addressForm}
          onSubmit={(event) => {
            event.preventDefault()
            void saveAddress()
          }}
        >
          <input
            style={field}
            value={wanted}
            autoFocus
            disabled={busy !== undefined}
            aria-label="Address"
            onChange={(event) => setWanted(event.target.value)}
          />
          <span style={{ ...muted, whiteSpace: 'nowrap' }}>.{user?.appHostSuffix}</span>
          <Button type="submit" disabled={busy !== undefined || !wanted.trim() || unchanged}>
            {busy === changing?.appName ? 'Saving…' : 'Save'}
          </Button>
        </form>
        {addressProblem ? (
          <p style={{ margin: 'var(--space-md) 0 0', color: 'var(--color-failure)', fontSize: '0.85rem' }}>{addressProblem}</p>
        ) : null}
        <p style={{ ...muted, fontSize: '0.8rem', margin: 'var(--space-md) 0 0' }}>
          One label under {user?.appHostSuffix}, unique across every tenant, so the one you ask for may already be
          taken. Links to the old address stop working as soon as you save.
        </p>
      </Modal>

      <Modal
        open={resizing !== undefined}
        onClose={() => setResizing(undefined)}
        title={resizing?.to === 'large' ? `Make ${resizing?.app.appName ?? ''} large?` : `Make ${resizing?.app.appName ?? ''} small?`}
        footer={
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setResizing(undefined)}>Leave it</Button>
            <Button variant="primary" onClick={() => void resize()}>
              {resizing?.to === 'large' ? `Switch to large · ${priceOf('large')}/mo` : `Switch to small · ${priceOf('small')}/mo`}
            </Button>
          </div>
        }
      >
        <p style={{ marginTop: 0 }}>
          {resizing?.to === 'large'
            ? `${LARGE_EXPLAINED} It costs ${priceOf('large')} a month instead of ${priceOf('small')}, charged by the day from today.`
            : `A small instance costs ${priceOf('small')} a month instead of ${priceOf('large')}, charged by the day from today.`}
        </p>
        <p style={{ margin: 'var(--space-md) 0 0', fontSize: '0.85rem', ...muted }}>
          The app is restarted on the new instance. Anything it has in hand is finished first.
        </p>
      </Modal>

      <Modal
        open={removing !== undefined}
        onClose={() => setRemoving(undefined)}
        title={`Tear down ${removing?.appName ?? ''}?`}
        footer={
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setRemoving(undefined)}>Keep it</Button>
            <Button variant="danger" onClick={() => removing && void tearDown(removing)}>Tear down</Button>
          </div>
        }
      >
        <p style={{ marginTop: 0 }}>
          This stops the app and removes it. Anything it has in hand is finished first, which can take a few
          minutes, and its address is then free for someone else to take.
        </p>
      </Modal>
    </div>
  )
}

export { ManageAppsPage }
