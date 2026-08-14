import './Badge.css'
import { type HTMLAttributes, type ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  /** Show a leading status dot. */
  dot?: boolean
  children: ReactNode
}

/**
 * Badge — a small status label / tag in one of the semantic tones.
 */
export function Badge({
  tone = 'neutral',
  dot = false,
  children,
  className,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={['ds-badge', `ds-badge--${tone}`, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {dot ? <span className="ds-badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}
