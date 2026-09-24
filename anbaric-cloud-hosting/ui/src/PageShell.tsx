import './PageShell.css'
import type { CSSProperties, ReactNode } from 'react'

import logo from '@anbaric/design-system/shared/assets/anbaric-logo.svg'

/* Two shapes, told apart by whether a nav was given. Inside the console the nav
   names the page and the content sits beside it. On its own - signing up,
   authorizing a terminal, choosing a tenant - there is no nav to lean on, so the
   page carries the mark itself and centres in the window. These are the first
   screens anyone sees, and an unbranded box floating against the left edge of an
   empty page is not the first impression to give them. */
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
  const alone = !nav

  return (
    <div
      className={alone ? 'ds-page-layout ds-page-layout--alone' : 'ds-page-layout'}
      style={{ ['--nav-w']: collapsed ? '4.25rem' : '14rem' } as CSSProperties}
    >
      {nav}
      <main className="ds-page-main" style={{ maxWidth: width }}>
        {alone ? (
          <header className="ds-page-brand">
            <img className="ds-page-brand__logo" src={logo} alt="Anbaric" />
          </header>
        ) : null}
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
