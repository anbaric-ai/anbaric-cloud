import './Card.css'
import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** A title row above the content, in the headline treatment. */
  title?: ReactNode
  /** A line under the title, for a count or a short explanation. */
  subtitle?: ReactNode
  /** Controls on the right of the title row: a button, a menu. */
  actions?: ReactNode
  /** Lifts on hover, for a card that is itself something to click. */
  interactive?: boolean
  children?: ReactNode
}

/**
 * Card — a flat surface container that owns its spacing and keeps corners
 * concentric (container radius on the card, element radius on every direct
 * child). Framed by a hairline, with no shadow at rest. An optional head
 * carries a title, a subtitle and actions.
 */
export function Card({ title, subtitle, actions, interactive = false, className, children, ...rest }: CardProps) {
  const headed = title !== undefined || actions !== undefined
  return (
    <div className="ds-card-root">
      <div
        className={['ds-card', interactive && 'ds-card--interactive', className].filter(Boolean).join(' ')}
        {...rest}
      >
        {headed ? (
          <div className="ds-card__head">
            <div>
              {title !== undefined ? <h2 className="ds-card__title">{title}</h2> : null}
              {subtitle !== undefined ? <p className="ds-card__subtitle">{subtitle}</p> : null}
            </div>
            {actions !== undefined ? <div className="ds-card__actions">{actions}</div> : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}
