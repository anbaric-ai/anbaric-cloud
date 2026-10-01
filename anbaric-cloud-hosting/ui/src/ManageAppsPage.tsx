import { useEffect, useState, type CSSProperties } from 'react'

import { Alert } from '@anbaric/design-system/components/Alert'
import { Badge } from '@anbaric/design-system/components/Badge'
import { Button } from '@anbaric/design-system/components/Button'
import { Card } from '@anbaric/design-system/components/Card'
import { Modal } from '@anbaric/design-system/components/Modal'

import { appUrl, type CurrentUser } from './appUrl'

type ManagedApp = {
  appName: string
  status: string
  subdomain?: string
  url?: string
  draining?: { inFlight: number; since: number }
}

const muted: CSSProperties = { color: 'var(--color-foreground-tint-2)' }

const rows: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }

const row: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--space-md)',
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
  minWidth: '10rem',
}

const tone = (status: string) =>
  status === 'running' ? 'success' : status === 'failed' ? 'danger' : status === 'building' ? 'primary' : 'neutral'

/* What a builder can do to a deployed app from the console: move it to a
   different address, or take it away. Deploying stays the CLI's job - this is
   for the two things that have no other home. */
function ManageAppsPage() {
  const [apps, setApps] = useState<ManagedApp[] | undefined>(undefined)
  const [user, setUser] = useState<CurrentUser | undefined>(undefined)
  const [problem, setProblem] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState<string | undefined>(undefined)
  const [editing, setEditing] = useState<Record<string, string>>({})
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
  }, [])

  const addressable = Boolean(user?.appHostSuffix)

  const saveAddress = async (app: ManagedApp) => {
    const wanted = (editing[app.appName] ?? '').trim().toLowerCase()
    if (!wanted || wanted === app.subdomain) return

    setBusy(app.appName)
    setProblem(undefined)
    try {
      const response = await fetch(`/api/v2/apps/${encodeURIComponent(app.appName)}/subdomain`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subdomain: wanted }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error ?? 'That address is not available')

      setEditing((held) => ({ ...held, [app.appName]: '' }))
      await load()
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'That address is not available')
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
            <span style={{ flex: '1 1 12rem', minWidth: 0 }}>
              <h2 style={appTitle}>{app.appName}</h2>
              <span style={{ display: 'block', fontSize: '0.8rem', ...muted }}>
                {app.subdomain
                  ? <a href={appUrl(app)} style={{ color: 'inherit' }}>{app.subdomain}.{user?.appHostSuffix}</a>
                  : addressable ? 'No address yet' : `/app/${app.appName}`}
              </span>
            </span>

            <Badge tone={tone(app.status)}>{app.status}</Badge>

            {addressable ? (
              <span style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                <label>
                  <span style={{ display: 'block', fontSize: '0.75rem', ...muted }}>Address</span>
                  <input
                    style={field}
                    value={editing[app.appName] ?? ''}
                    placeholder={app.subdomain ?? app.appName}
                    disabled={busy !== undefined}
                    onChange={(event) => setEditing((held) => ({ ...held, [app.appName]: event.target.value }))}
                  />
                </label>
                <Button
                  variant="ghost"
                  disabled={busy !== undefined || !(editing[app.appName] ?? '').trim()}
                  onClick={() => void saveAddress(app)}
                >
                  {busy === app.appName ? 'Saving…' : 'Save'}
                </Button>
              </span>
            ) : null}

            <Button variant="danger" disabled={busy !== undefined} onClick={() => setRemoving(app)}>
              Tear down
            </Button>
          </div>

          {app.draining ? (
            <p style={{ margin: 'var(--space-sm) 0 0', fontSize: '0.8rem', ...muted }}>
              Draining: {app.draining.inFlight} step(s) still in flight.
            </p>
          ) : null}
        </Card>
      ))}

      {addressable ? (
        <p style={{ ...muted, fontSize: '0.8rem', margin: 0 }}>
          An address is one label under {user?.appHostSuffix} and has to be unique across every tenant, so the
          one you ask for may already be taken.
        </p>
      ) : null}

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
