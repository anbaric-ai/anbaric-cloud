import type { CSSProperties } from 'react'

const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—'

const machineHeading: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-title)',
  fontSize: '1.15rem',
  textTransform: 'var(--title-transform)' as CSSProperties['textTransform'],
}

const cell: CSSProperties = {
  textAlign: 'left',
  padding: 'calc(var(--space-sm) / 2) var(--space-sm)',
  borderBottom: '1px solid color-mix(in srgb, var(--color-grey) 12%, transparent)',
}

const headerCell: CSSProperties = {
  ...cell,
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-foreground-tint-2)',
}

const mono: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.78rem',
}

const muted: CSSProperties = {
  color: 'var(--color-foreground-tint-2)',
}

// Tables of job properties get wide; scroll them rather than break the page.
const tableScroller: CSSProperties = {
  overflowX: 'auto',
  maxWidth: '100%',
}

export { cell, formatDate, headerCell, machineHeading, mono, muted, tableScroller }
