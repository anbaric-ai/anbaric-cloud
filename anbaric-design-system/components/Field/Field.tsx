import './Field.css'
import { useId, type CSSProperties, type ReactNode } from 'react'

export interface FieldProps {
  label: ReactNode
  /** A line beneath the control: what to put in it, or what it is for. */
  hint?: ReactNode
  /** Replaces the hint and colours the control when something is wrong. */
  error?: ReactNode
  required?: boolean
  /** The control's id, when it has one of its own; otherwise one is made. */
  htmlFor?: string
  /** The control: an input, select or textarea, or anything that takes `id`. */
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/**
 * Field — a label, a control and a line beneath it, as one piece, so labels
 * stop being ad hoc spans. The control inside takes the system's field look
 * whether or not the field sits in a Form. The label is tied to the control
 * by id, so clicking it focuses the control.
 */
export function Field({ label, hint, error, required = false, htmlFor, children, className, style }: FieldProps) {
  const made = useId()
  const id = htmlFor ?? `ds-field-${made.replace(/:/g, '')}`
  return (
    <div className={['ds-field', error && 'ds-field--invalid', className].filter(Boolean).join(' ')} style={style}>
      <label className="ds-field__label" htmlFor={id}>
        {label}
        {required ? <span className="ds-field__required" aria-hidden="true">*</span> : null}
      </label>
      {children}
      {error ? (
        <span className="ds-field__error" role="alert">{error}</span>
      ) : hint ? (
        <span className="ds-field__hint">{hint}</span>
      ) : null}
    </div>
  )
}
