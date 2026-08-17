import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@anbaric/design-system/tokens.css'
import './plugins/PluginRuntime'

import { AuditPage } from './AuditPage'
import { AuthorizeCliPage } from './AuthorizeCliPage'
import { ManageKeysPage } from './ManageKeysPage'
import { PageShell } from './PageShell'
import { PlatformNav } from './PlatformNav'
import { PluginPage } from './PluginPage'
import { loadPlugins } from './plugins/loadPlugins'
import { PluginRegistry, registry, setRegistry } from './plugins/PluginRegistry'

function App() {
  const path = window.location.pathname
  if (path.startsWith('/authorize-cli/')) {
    return <AuthorizeCliPage requestId={path.split('/')[2]} />
  }
  if (path === '/manage-keys') {
    return <ManageKeysPage />
  }
  if (path === '/audit') {
    return <AuditPage />
  }
  if (registry().pageAt(path)) {
    return <PluginPage path={path} />
  }
  return (
    <PageShell title="Anbaric" width="64rem" nav={<PlatformNav />}>
      <p style={{ margin: 0, color: 'var(--color-foreground-tint-2)' }}>
        No page is registered at {path}. Load a plugin that registers it via ANBARIC_PLUGINS.
      </p>
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
