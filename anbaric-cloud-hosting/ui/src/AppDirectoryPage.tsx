import { useEffect, useState, type CSSProperties } from 'react'

import { AvatarMenu } from '@anbaric/design-system/components/AvatarMenu'
import { Badge } from '@anbaric/design-system/components/Badge'
import { Card } from '@anbaric/design-system/components/Card'

import logo from '@anbaric/design-system/shared/assets/anbaric-logo.svg'

import { appUrl, type CurrentUser } from './appUrl'

type DirectoryApp = { appName: string; status: string; subdomain?: string; url?: string }

const Sym = ({ name }: { name: string }) => (
  <span className="material-symbols-rounded" aria-hidden="true">{name}</span>
)

const muted: CSSProperties = { color: 'var(--color-foreground-tint-2)' }

const page: CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-lg)',
  padding: 'var(--space-lg)',
  paddingBottom: 'calc(var(--space-lg) * 4)',
  maxWidth: '72rem',
  margin: '0 auto',
}

// One tile per app, as many across as the window allows, down to one.
const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 16rem), 1fr))',
  gap: 'var(--space-md)',
}

const tile: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
  textDecoration: 'none',
  color: 'inherit',
}

const appTitle: CSSProperties = {
  fontFamily: 'var(--font-title)',
  fontSize: '1.125rem',
  lineHeight: 1.1,
  margin: 0,
}

// Pinned where the nav's account control sits in the full console, so the same
// thing is in the same place whichever console you are given.
const corner: CSSProperties = {
  position: 'fixed',
  left: 'var(--space-md)',
  bottom: 'var(--space-md)',
  zIndex: 10,
}

const readable = (appName: string) =>
  appName.replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())

/* What someone who is not a builder gets instead of the console: the apps they
   have been given access to, and nothing else. No nav, because there is
   nowhere else for them to go - only their account, in the corner. */
function AppDirectoryPage() {
  const [apps, setApps] = useState<DirectoryApp[] | undefined>(undefined)
  const [user, setUser] = useState<CurrentUser | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    void fetch('/api/v2/my-apps')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('my-apps'))))
      .then((mine: DirectoryApp[]) => { if (live) setApps(mine) })
      .catch(() => { if (live) setFailed(true) })
    void fetch('/api/v2/whoami')
      .then((response) => (response.ok ? response.json() : undefined))
      .then((who: CurrentUser | undefined) => { if (live) setUser(who) })
      .catch(() => {})
    return () => { live = false }
  }, [])

  return (
    <div style={page}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <img src={logo} alt="Anbaric" style={{ height: '1.75rem' }} />
      </header>

      <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', margin: 0 }}>Your apps</h1>

      {failed ? (
        <Card><p style={{ margin: 0, ...muted }}>Couldn't load your apps. Try refreshing.</p></Card>
      ) : !apps ? (
        <Card><p style={{ margin: 0, ...muted }}>Loading…</p></Card>
      ) : apps.length === 0 ? (
        <Card>
          <p style={{ margin: 0, ...muted }}>
            You don't have access to any apps yet. Whoever invited you can give you access.
          </p>
        </Card>
      ) : (
        <div style={grid}>
          {apps.map((app) => {
            const running = app.status === 'running'
            return (
              <a
                key={app.appName}
                href={running ? appUrl(app) : undefined}
                style={{ ...tile, opacity: running ? 1 : 0.6, pointerEvents: running ? 'auto' : 'none' }}
                aria-disabled={running ? undefined : true}
              >
                <Card>
                  <div style={{ display: 'flex', alignItems: 'start', gap: 'var(--space-sm)' }}>
                    <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <h2 style={appTitle}>{readable(app.appName)}</h2>
                      <span style={{ display: 'block', fontSize: '0.8rem', ...muted }}>{app.appName}</span>
                    </span>
                    <Sym name={running ? 'arrow_outward' : 'pause_circle'} />
                  </div>
                  {running ? null : (
                    <p style={{ margin: 'var(--space-sm) 0 0' }}><Badge tone="warning">Not running</Badge></p>
                  )}
                </Card>
              </a>
            )
          })}
        </div>
      )}

      {user ? (
        <div style={corner}>
          <AvatarMenu
            name={user.name ?? user.id}
            subtitle={user.tenant}
            src={user.picture}
            items={[{ label: 'Sign out', onSelect: () => (window.location.href = '/logout') }]}
            action={{
              icon: <Sym name="swap_horiz" />,
              label: 'Switch tenant',
              onSelect: () => (window.location.href = '/choose-tenant'),
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

export { AppDirectoryPage }
