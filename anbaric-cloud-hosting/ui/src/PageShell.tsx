import './PageShell.css'
import type { CSSProperties, ReactNode } from 'react'

function PageShell({
  title,
  width = '30rem',
  nav,
  collapsed = false,
  children,
}: {
  title: string
  width?: string
  nav?: ReactNode
  collapsed?: boolean
  children: ReactNode
}) {
  return (
    <div
      className="ds-page-layout"
      style={{ ['--nav-w']: collapsed ? '4.25rem' : '14rem' } as CSSProperties}
    >
      {nav}
      <main className="ds-page-main" style={{ maxWidth: width }}>
        {/* With a nav the heading only repeats the highlighted entry, so it is
            kept for structure and screen readers but not shown. A page served
            on its own - the CLI authorize flow - has nothing else naming it. */}
        <h1 className={nav ? 'ds-page-heading ds-page-heading--assistive' : 'ds-page-heading'}>
          {title}
        </h1>
        {children}
      </main>
    </div>
  )
}

export { PageShell }
