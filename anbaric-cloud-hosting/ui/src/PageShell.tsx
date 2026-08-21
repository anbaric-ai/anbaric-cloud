import './PageShell.css'
import type { ReactNode } from 'react'

function PageShell({
  title,
  width = '30rem',
  nav,
  children,
}: {
  title: string
  width?: string
  nav?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="ds-page-layout">
      {nav}
      <div style={{ flex: 1, minWidth: 0 }}>
        <main className="ds-page-main" style={{ maxWidth: width }}>
          <h1 className="ds-page-heading">{title}</h1>
          {children}
        </main>
      </div>
    </div>
  )
}

export { PageShell }
