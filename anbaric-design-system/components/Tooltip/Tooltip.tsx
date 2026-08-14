import './Tooltip.css'
import { useId, type HTMLAttributes, type ReactNode } from 'react'

export interface TooltipProps extends HTMLAttributes<HTMLSpanElement> {
  /** The tooltip content shown on hover/focus. */
  label: ReactNode
  /** The trigger element(s). */
  children: ReactNode
}

/**
 * Tooltip — shows a label above its trigger on hover or keyboard focus. The
 * bubble sits at popover elevation. Hover/focus visibility is handled in CSS;
 * the trigger is focusable and linked to the bubble via aria-describedby.
 */
export function Tooltip({ label, children, className, ...rest }: TooltipProps) {
  const id = useId()
  return (
    <span className={['ds-tooltip', className].filter(Boolean).join(' ')} {...rest}>
      <span className="ds-tooltip__trigger" tabIndex={0} aria-describedby={id}>
        {children}
      </span>
      <span role="tooltip" id={id} className="ds-tooltip__bubble">
        {label}
      </span>
    </span>
  )
}
