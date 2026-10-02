import { StrictMode, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

import '@anbaric/design-system/tokens.css'
import './plugins/PluginRuntime'

import { AppDirectoryPage } from './AppDirectoryPage'
import { AuditPage } from './AuditPage'
import { GettingStartedPage } from './GettingStartedPage'
import { AuthorizeCliPage } from './AuthorizeCliPage'
import { SubscribePage } from './SubscribePage'
import { ChooseTenantPage } from './ChooseTenantPage'
import { IdentityBar } from './IdentityBar'
import { ManageAppsPage } from './ManageAppsPage'
import { ManageKeysPage } from './ManageKeysPage'
import { PageShell } from './PageShell'
import { PlatformNav } from './PlatformNav'
import { PluginPage } from './PluginPage'
import { loadPlugins } from './plugins/loadPlugins'
import { PluginRegistry, registry, setRegistry } from './plugins/PluginRegistry'

const MOBILE_MAX = 640
const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX

// The admin console routes on the URL hash (#/jobs), so a hard refresh always
// loads the SPA at "/" and never collides with an API route or the app proxy.
// The CLI-authorize flow is the one exception: it is a real server-served path.
const routeFromLocation = () => {
  const pathname = window.location.pathname
  if (pathname.startsWith('/authorize-cli/') || pathname.startsWith('/subscribe')) return pathname
  if (pathname.startsWith('/choose-tenant')) return pathname
  return window.location.hash.replace(/^#/, '') || '/'
}

// The three pages central serves itself, outside any console.
const isStandalone = (path: string) =>
  path.startsWith('/authorize-cli/') || path.startsWith('/subscribe') || path.startsWith('/choose-tenant')

function pageFor(path: string): { title: string; width: string; body: ReactNode } {
  if (path === '/manage-keys') return { title: 'Manage keys', width: '30rem', body: <ManageKeysPage /> }
  if (path === '/manage-apps') return { title: 'Manage apps', width: '64rem', body: <ManageAppsPage /> }
  if (path === '/audit') return { title: 'Audit', width: '64rem', body: <AuditPage /> }
  const page = registry().pageAt(path)
  if (page) return { title: page.title, width: '64rem', body: <PluginPage path={path} /> }
  return {
    title: 'Anbaric',
    width: '64rem',
    body: (
      <p style={{ margin: 0, color: 'var(--color-foreground-tint-2)' }}>
        No page is registered at {path}. Load a plugin that registers it via ANBARIC_PLUGINS.
      </p>
    ),
  }
}

function App() {
  const [path, setPath] = useState(routeFromLocation)
  // Nav collapse is app state: it survives client-side navigation (the shell
  // stays mounted) but resets on a hard reload. Collapsed by default on mobile.
  const [collapsed, setCollapsed] = useState(isMobile)
  const [role, setRole] = useState<string | null | undefined>(undefined)
  // How many apps are deployed, or undefined until known. A console with
  // nothing deployed has nothing to show, so its front page is how to deploy.
  const [appCount, setAppCount] = useState<number | undefined>(undefined)

  useEffect(() => {
    const onRoute = () => setPath(routeFromLocation())
    window.addEventListener('hashchange', onRoute)
    window.addEventListener('popstate', onRoute)
    return () => {
      window.removeEventListener('hashchange', onRoute)
      window.removeEventListener('popstate', onRoute)
    }
  }, [])

  /* Whether this person gets the console at all. A USER is given the app
     directory instead, wherever they point their browser, because none of the
     console is theirs to use. Null means the question has been asked and
     answered with no role, which is what an unmanaged platform says - there
     everyone gets the console, as they always have. */
  useEffect(() => {
    // Central serves the standalone pages and has no platform API behind it,
    // so there is no role to ask for and nothing waiting on one.
    if (isStandalone(path)) return setRole(null)

    void fetch('/api/v2/whoami')
      .then((response) => (response.ok ? response.json() : undefined))
      .then((who: { tenantRole?: string } | undefined) => setRole(who?.tenantRole ?? null))
      .catch(() => setRole(null))
    void fetch('/api/v2/apps')
      .then((response) => (response.ok ? response.json() : []))
      .then((apps: unknown[]) => setAppCount(apps.length))
      .catch(() => setAppCount(undefined))
  }, [])

  // The CLI-authorize, subscribe and choose-tenant flows are standalone pages
  // reached directly, outside the nav - so they carry their own identity
  // control (who you are, sign out) pinned top-right.
  if (isStandalone(path)) {
    return (
      <>
        <div style={{ position: 'fixed', top: 'var(--space-md)', right: 'var(--space-md)', zIndex: 10 }}>
          <IdentityBar />
        </div>
        {path.startsWith('/authorize-cli/')
          ? <AuthorizeCliPage requestId={path.split('/')[2]} />
          : path.startsWith('/choose-tenant')
            ? <ChooseTenantPage />
            : <SubscribePage />}
      </>
    )
  }

  /* The directory has a route of its own as well as being what a USER is
     given, because a platform that enforces no roles has no USERs at all and
     the page would otherwise be unreachable there. */
  if (path === '/apps' || role === 'USER') return <AppDirectoryPage />

  // Nothing is rendered until the role is known, or a USER would see the
  // console flash past on its way to being replaced.
  if (role === undefined) return null

  const navigate = (to: string) => {
    if (to === path) return
    window.location.hash = to
    setPath(to)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (isMobile()) setCollapsed(true)
  }

  /* A tenant with nothing deployed yet - someone who subscribed on the web
     rather than from a deploy - would otherwise land on an empty dashboard.
     Until the first app arrives, the front page is how to get one there. */
  const page = path === '/' && appCount === 0
    ? { title: 'Get started', width: '64rem', body: <GettingStartedPage /> }
    : pageFor(path)

  return (
    <PageShell
      title={page.title}
      width={page.width}
      collapsed={collapsed}
      nav={
        <PlatformNav
          active={path}
          navigate={navigate}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
        />
      }
    >
      {page.body}
    </PageShell>
  )
}

async function bootstrap() {
  const root = document.getElementById('root')
  if (!root) return
  setRegistry(new PluginRegistry(await loadPlugins()))
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
