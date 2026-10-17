import './EmptyState.css'
import type { ReactNode } from 'react'

export interface EmptyStateProps {
  /** A Material Symbols name for the mark. */
  icon?: string
  /** A figure instead of an icon: "0", say. */
  figure?: ReactNode
  title: ReactNode
  children?: ReactNode
  /** The one thing to do about it, usually a Button. */
  action?: ReactNode
  className?: string
}

/**
 * EmptyState — what a list says when there is nothing in it: a mark, a title
 * in the headline treatment, a line of body and one action. It sits on the
 * canvas, not in a card, so an empty page stays as quiet as a full one.
 */
export function EmptyState({ icon, figure, title, children, action, className }: EmptyStateProps) {
  return (
    <div className={['ds-empty', className].filter(Boolean).join(' ')} role="status">
      {figure !== undefined ? (
        <span className="ds-empty__figure" aria-hidden="true">{figure}</span>
      ) : icon ? (
        <span className="ds-empty__mark" aria-hidden="true">
          <span className="material-symbols-rounded">{icon}</span>
        </span>
      ) : null}
      <h3 className="ds-empty__title">{title}</h3>
      {children ? <p className="ds-empty__body">{children}</p> : null}
      {action ? <div className="ds-empty__action">{action}</div> : null}
    </div>
  )
}
