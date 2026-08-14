import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@anbaric/design-system/tokens.css'

import { AuthorizeCliPage } from './AuthorizeCliPage'
import { ManageKeysPage } from './ManageKeysPage'

function App() {
  const path = window.location.pathname
  if (path.startsWith('/authorize-cli/')) {
    return <AuthorizeCliPage requestId={path.split('/')[2]} />
  }
  return <ManageKeysPage />
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
