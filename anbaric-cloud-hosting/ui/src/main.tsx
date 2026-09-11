import { StrictMode, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

import '@anbaric/design-system/tokens.css'
import './plugins/PluginRuntime'

import { AuditPage } from './AuditPage'
import { AuthorizeCliPage } from './AuthorizeCliPage'
import { SubscribePage } from './SubscribePage'
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
  return window.location.hash.replace(/^#/, '') || '/'
}

function pageFor(path: string): { title: string; width: string; body: ReactNode } {
  if (path === '/manage-keys') return { title: 'Manage keys', width: '30rem', body: <ManageKeysPage /> }
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

  useEffect(() => {
    const onRoute = () => setPath(routeFromLocation())
    window.addEventListener('hashchange', onRoute)
    window.addEventListener('popstate', onRoute)
    return () => {
      window.removeEventListener('hashchange', onRoute)
      window.removeEventListener('popstate', onRoute)
    }
  }, [])

  // The CLI-authorize and subscribe flows are standalone pages reached directly,
  // outside the nav.
  if (path.startsWith('/authorize-cli/')) {
    return <AuthorizeCliPage requestId={path.split('/')[2]} />
  }
  if (path.startsWith('/subscribe')) {
    return <SubscribePage />
  }

  const navigate = (to: string) => {
    if (to === path) return
    window.location.hash = to
    setPath(to)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (isMobile()) setCollapsed(true)
  }

  const page = pageFor(path)

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
