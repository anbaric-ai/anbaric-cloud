import './Section.css'
import { type HTMLAttributes, type ReactNode } from 'react'

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** The section heading. Omit for an unlabelled group. */
  title?: ReactNode
  /** Optional right-aligned content on the title row (a button, count, link). */
  actions?: ReactNode
  /** Show a divider beneath the title. Defaults to true when there is a title. */
  rule?: boolean
  children?: ReactNode
}

/**
 * Section — a title with an optional rule and its content, with no surface or
 * padding. A lighter alternative to Card for structuring a page.
 */
export function Section({ title, actions, rule, children, className, ...rest }: SectionProps) {
  const hasHeader = title != null || actions != null
  const showRule = rule ?? title != null

  return (
    <section className={['ds-section', className].filter(Boolean).join(' ')} {...rest}>
      {hasHeader ? (
        <div className="ds-section__head">
          <header className="ds-section__header">
            {title != null ? <h2 className="ds-section__title">{title}</h2> : <span />}
            {actions != null ? <div className="ds-section__actions">{actions}</div> : null}
          </header>
          {showRule ? <hr className="ds-section__rule" /> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
