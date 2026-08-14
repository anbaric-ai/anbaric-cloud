import type { CSSProperties, ReactNode } from 'react'

const layout: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-lg)',
  margin: '0 auto',
  padding: 'var(--space-lg) var(--space-md)',
}

const content: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-lg)',
}

const heading: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-title)',
  fontWeight: 'var(--font-weight-bold)' as CSSProperties['fontWeight'],
  fontSize: '2rem',
  lineHeight: 'var(--title-line-height)',
  textTransform: 'var(--title-transform)' as CSSProperties['textTransform'],
}

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
    <div style={{ ...layout, maxWidth: nav ? `calc(${width} + 18rem)` : width }}>
      {nav}
      <main style={content}>
        <h1 style={heading}>{title}</h1>
        {children}
      </main>
    </div>
  )
}

export { PageShell }
