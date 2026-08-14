import type { CSSProperties, ReactNode } from 'react'

const shell: CSSProperties = {
  maxWidth: '30rem',
  margin: '0 auto',
  padding: 'var(--space-lg) var(--space-md)',
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

function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={shell}>
      <h1 style={heading}>{title}</h1>
      {children}
    </main>
  )
}

export { PageShell }
