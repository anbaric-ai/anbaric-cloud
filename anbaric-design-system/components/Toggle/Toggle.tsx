import './Toggle.css'
import {
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'

export interface ToggleProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: ReactNode
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
}

/**
 * Toggle — an on/off switch over a native checkbox (`role="switch"`), so
 * keyboard and form behaviour are native. Controlled via `checked` or
 * uncontrolled via `defaultChecked`.
 */
export function Toggle({
  label,
  checked,
  defaultChecked,
  onChange,
  className,
  disabled,
  ...rest
}: ToggleProps) {
  const [internal, setInternal] = useState(defaultChecked ?? false)
  const isChecked = checked ?? internal

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInternal(event.target.checked)
    onChange?.(event.target.checked)
  }

  return (
    <label className={['ds-toggle', className].filter(Boolean).join(' ')}>
      <input
        type="checkbox"
        role="switch"
        className="ds-toggle__input"
        checked={isChecked}
        disabled={disabled}
        onChange={handleChange}
        {...rest}
      />
      <span className="ds-toggle__track" aria-hidden="true">
        <span className="ds-toggle__thumb" />
      </span>
      {label ? <span className="ds-toggle__label">{label}</span> : null}
    </label>
  )
}
