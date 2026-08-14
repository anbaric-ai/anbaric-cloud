import './Card.css'
import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
}

/**
 * Card — a glass surface container that owns its spacing and keeps corners
 * concentric (container radius on the card, element radius on every direct
 * child).
 *
 * The 1px frame is a REAL element (`.ds-card-border`) rendered *before* the
 * card surface and sitting genuinely behind it — not a pseudo-element. A mask
 * reveals only its outermost pixel; if masking is unsupported, the surface in
 * front still covers the interior, so it degrades to a plain 1px border.
 */
export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div className="ds-card-root">
      <div className="ds-card-border" aria-hidden="true" />
      <div className={['ds-card', className].filter(Boolean).join(' ')} {...rest}>
        {children}
      </div>
    </div>
  )
}
