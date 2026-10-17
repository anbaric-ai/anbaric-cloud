import './Skeleton.css'
import type { CSSProperties } from 'react'

export interface SkeletonProps {
  /** As CSS. Defaults to the full width. */
  width?: string
  /** As CSS. Defaults to one line of text. */
  height?: string
  /** A circle, for an avatar. */
  round?: boolean
  /** Several lines of text, the last one shorter. */
  lines?: number
  className?: string
}

/**
 * Skeleton — the shape of what is loading, in a quiet shimmer, so a page
 * keeps its layout while its data arrives instead of saying "Loading…".
 * One block by default; `lines` gives a paragraph.
 */
export function Skeleton({ width, height, round = false, lines, className }: SkeletonProps) {
  const style: CSSProperties = { width, height }
  if (lines && lines > 1) {
    return (
      <div className={['ds-skeleton-text', className].filter(Boolean).join(' ')} aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span key={index} className="ds-skeleton" style={{ height }} />
        ))}
      </div>
    )
  }
  return <span className={['ds-skeleton', round && 'ds-skeleton--round', className].filter(Boolean).join(' ')} style={style} aria-hidden="true" />
}
