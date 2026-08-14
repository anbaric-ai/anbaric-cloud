import type { CSSProperties, ReactNode } from 'react'

const layout: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-lg)',
  padding: 'var(--space-lg) var(--space-md)',
}

const content: CSSProperties = {
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-lg)',
  width: '100%',
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
    <div style={layout}>
      {nav}
      <div style={{ flex: 1, minWidth: 0 }}>
        <main style={{ ...content, maxWidth: width }}>
          <h1 style={heading}>{title}</h1>
          {children}
        </main>
      </div>
    </div>
  )
}

export { PageShell }
