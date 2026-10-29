import { useEffect, useState, type CSSProperties } from 'react'

import { Alert } from '@anbaric/design-system/components/Alert'
import { Badge } from '@anbaric/design-system/components/Badge'
import { Button } from '@anbaric/design-system/components/Button'
import { EmptyState } from '@anbaric/design-system/components/EmptyState'
import { Field } from '@anbaric/design-system/components/Field'
import { Modal } from '@anbaric/design-system/components/Modal'
import { RadioGroup } from '@anbaric/design-system/components/RadioGroup'
import { Section } from '@anbaric/design-system/components/Section'
import { Skeleton } from '@anbaric/design-system/components/Skeleton'
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
  // Absent on a platform that does not offer it.
  zeroDowntime?: boolean
  public?: boolean
}

// What each size, and each extra, costs a month, as the control plane quotes
// it in the tenant's currency. Absent on a platform with no control plane.
type Pricing = { small: string; large: string; zeroDowntime?: string; public?: string }

const muted: CSSProperties = { color: 'var(--color-foreground-tint-2)' }

/* A price is only ever shown in the viewer's own currency, as the control
   plane quotes it. One it has not quoted is left out rather than guessed. */
const perMonth = (label: string, price?: string) => (price ? `${label} · ${price}/mo` : label)

const rows: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }

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
}

const addressForm: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 'var(--space-sm)',
  flexWrap: 'wrap',
}

const sizeRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--space-md)',
}

const sizeLabel: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  minWidth: '5rem',
  ...muted,
}

const infoIcon: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1.1rem',
  height: '1.1rem',
  borderRadius: '50%',
  border: '1px solid var(--color-foreground-tint-2)',
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-mono)',
  cursor: 'help',
  ...muted,
}

const LARGE_EXPLAINED = 'A large instance gets faster compute and 2× the RAM.'
const ZERO_DOWNTIME_EXPLAINED =
  'A deploy brings the new version up beside the old one and only then lets the old one go, so the app never stops answering. Without it, the old version is stopped before the new one starts.'

const PUBLIC_EXPLAINED =
  'Anyone with the address can open the app without signing in, and needs no access entitlement. Members are still recognised, so other entitlements apply.'

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
  const [opening, setOpening] = useState<ManagedApp | undefined>(undefined)

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
      .then((summary?: { perApp?: { display: string }; perLargeApp?: { display: string }; perZeroDowntime?: { display: string }; perPublicApp?: { display: string } }) => {
        if (summary?.perApp && summary.perLargeApp) {
          setPricing({
            small: summary.perApp.display,
            large: summary.perLargeApp.display,
            zeroDowntime: summary.perZeroDowntime?.display,
            public: summary.perPublicApp?.display,
          })
        }
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

  /* Zero-downtime takes effect from the app's next deploy; public within a
     few seconds. Nothing restarts either way. */
  const setSwitch = async (app: ManagedApp, setting: 'zero-downtime' | 'public', on: boolean) => {
    const failure = setting === 'public' ? 'Could not change whether that app is public' : 'Could not change zero-downtime deploys for that app'
    setBusy(app.appName)
    setProblem(undefined)
    setOpening(undefined)
    try {
      const response = await fetch(`/api/v2/apps/${encodeURIComponent(app.appName)}/${setting}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ on }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error ?? failure)
      }
      await load()
    } catch (error) {
      setProblem(error instanceof Error ? error.message : failure)
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
    return problem ? <Alert variant="danger">{problem}</Alert> : <Skeleton lines={5} />
  }

  const unchanged = wanted.trim().toLowerCase() === (changing?.subdomain ?? '')

  return (
    <div style={rows}>
      {problem ? <Alert variant="danger">{problem}</Alert> : null}

      {apps.length === 0 ? (
        <EmptyState icon="rocket_launch" title="Nothing is deployed yet">
          Deploy an app with <code>anbaric app deploy</code>.
        </EmptyState>
      ) : null}

      {apps.map((app) => (
        <Section
          key={app.appName}
          title={app.appName}
          actions={
            <span style={actions}>
              <Badge tone={tone(app.status)}>{app.status}</Badge>
              {addressable ? (
                <Button variant="secondary" disabled={busy !== undefined} onClick={() => openChange(app)}>
                  Change URL
                </Button>
              ) : null}
              <Button variant="ghost" disabled={busy !== undefined} onClick={() => setRemoving(app)}>
                Tear down
              </Button>
            </span>
          }
        >
          <div style={row}>
            <span style={sizeLabel}>Address</span>
            <span style={{ fontSize: 'var(--text-sm)', ...muted }}>
              {app.subdomain
                ? <a href={appUrl(app)} style={{ color: 'inherit' }}>{app.subdomain}.{user?.appHostSuffix}</a>
                : addressable ? 'No address yet' : `/app/${app.appName}`}
            </span>
          </div>

          {pricing ? (
            <div style={sizeRow}>
              <span style={sizeLabel}>Instance</span>
              <RadioGroup
                name={`size-${app.appName}`}
                value={app.size ?? 'small'}
                onChange={(value) => { if (value !== (app.size ?? 'small')) setResizing({ app, to: value as AppSize }) }}
                options={[
                  { label: perMonth('Small', pricing.small), value: 'small', disabled: busy !== undefined },
                  { label: perMonth('Large', pricing.large), value: 'large', disabled: busy !== undefined },
                ]}
              />
              <Tooltip label={LARGE_EXPLAINED}>
                <span style={infoIcon} tabIndex={0} aria-label={LARGE_EXPLAINED}>i</span>
              </Tooltip>
            </div>
          ) : null}

          {pricing && app.zeroDowntime !== undefined ? (
            <div style={sizeRow}>
              <span style={sizeLabel}>Deploys</span>
              <Toggle
                checked={app.zeroDowntime}
                disabled={busy !== undefined}
                onChange={(on) => void setSwitch(app, 'zero-downtime', on)}
                label={perMonth('Zero-downtime deploys', pricing.zeroDowntime)}
              />
              <Tooltip label={ZERO_DOWNTIME_EXPLAINED}>
                <span style={infoIcon} tabIndex={0} aria-label={ZERO_DOWNTIME_EXPLAINED}>i</span>
              </Tooltip>
            </div>
          ) : null}

          {pricing && app.public !== undefined ? (
            <div style={sizeRow}>
              <span style={sizeLabel}>Access</span>
              <Toggle
                checked={app.public}
                disabled={busy !== undefined}
                onChange={(on) => (on ? setOpening(app) : void setSwitch(app, 'public', false))}
                label={perMonth('Public', pricing.public)}
              />
              <Tooltip label={PUBLIC_EXPLAINED}>
                <span style={infoIcon} tabIndex={0} aria-label={PUBLIC_EXPLAINED}>i</span>
              </Tooltip>
            </div>
          ) : null}

          {app.draining ? (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', ...muted }}>
              Draining: {app.draining.inFlight} step(s) still in flight.
            </p>
          ) : null}
        </Section>
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
          <Field label="Address" error={addressProblem}>
            <input
              value={wanted}
              autoFocus
              disabled={busy !== undefined}
              onChange={(event) => setWanted(event.target.value)}
            />
          </Field>
          <span style={{ ...muted, whiteSpace: 'nowrap', paddingBottom: 'var(--space-sm)' }}>.{user?.appHostSuffix}</span>
          <Button type="submit" disabled={busy !== undefined || !wanted.trim() || unchanged}>
            {busy === changing?.appName ? 'Saving…' : 'Save'}
          </Button>
        </form>
        <p style={{ ...muted, fontSize: 'var(--text-sm)', margin: 'var(--space-md) 0 0' }}>
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
            <Button variant="secondary" onClick={() => setResizing(undefined)}>Leave it</Button>
            <Button variant="primary" onClick={() => void resize()}>
              {resizing?.to === 'large' ? perMonth('Switch to large', pricing?.large) : perMonth('Switch to small', pricing?.small)}
            </Button>
          </div>
        }
      >
        <p style={{ marginTop: 0 }}>
          {resizing?.to === 'large'
            ? `${LARGE_EXPLAINED} It costs ${pricing?.large} a month instead of ${pricing?.small}, charged by the day from today, and is never covered by the free allowance.`
            : `A small instance costs ${pricing?.small} a month instead of ${pricing?.large}, charged by the day from today.`}
        </p>
        <p style={{ margin: 'var(--space-md) 0 0', fontSize: 'var(--text-sm)', ...muted }}>
          The app is restarted on the new instance. Anything it has in hand is finished first.
        </p>
      </Modal>

      <Modal
        open={opening !== undefined}
        onClose={() => setOpening(undefined)}
        title={`Make ${opening?.appName ?? ''} public?`}
        footer={
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setOpening(undefined)}>Keep it private</Button>
            <Button variant="primary" onClick={() => opening && void setSwitch(opening, 'public', true)}>
              {perMonth('Make public', pricing?.public)}
            </Button>
          </div>
        }
      >
        <p style={{ marginTop: 0 }}>
          {PUBLIC_EXPLAINED}{' '}
          {pricing?.public ? `It costs ${pricing.public} a month, charged by the day from today, and is` : 'It is charged by the day from today, and is'}
          {' '}never covered by the free allowance.
        </p>
        <p style={{ margin: 'var(--space-md) 0 0', fontSize: 'var(--text-sm)', ...muted }}>
          The app itself decides what an anonymous visitor may see and do. A member can sign in from it by following
          a link to <code>/login</code> on the app's own address.
        </p>
      </Modal>

      <Modal
        open={removing !== undefined}
        onClose={() => setRemoving(undefined)}
        title={`Tear down ${removing?.appName ?? ''}?`}
        footer={
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setRemoving(undefined)}>Keep it</Button>
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
