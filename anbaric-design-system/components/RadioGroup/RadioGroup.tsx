import './RadioGroup.css'
import { useState, type HTMLAttributes } from 'react'

export interface RadioOption {
  label: string
  value: string
  disabled?: boolean
}

export interface RadioGroupProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Shared name for the underlying radios. */
  name: string
  options: RadioOption[]
  /** Selected value (controlled). */
  value?: string
  /** Initial selected value (uncontrolled). */
  defaultValue?: string
  onChange?: (value: string) => void
}

/**
 * RadioGroup — a set of styled radio buttons over real `<input type="radio">`
 * elements (so keyboard and form behaviour are native). Controlled via `value`
 * or uncontrolled via `defaultValue`.
 */
export function RadioGroup({
  name,
  options,
  value,
  defaultValue,
  onChange,
  className,
  ...rest
}: RadioGroupProps) {
  const [internal, setInternal] = useState(defaultValue ?? '')
  const current = value ?? internal

  const select = (next: string) => {
    setInternal(next)
    onChange?.(next)
  }

  return (
    <div
      role="radiogroup"
      className={['ds-radio-group', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {options.map((option) => (
        <label className="ds-radio" key={option.value}>
          <input
            type="radio"
            className="ds-radio__input"
            name={name}
            value={option.value}
            checked={current === option.value}
            disabled={option.disabled}
            onChange={() => select(option.value)}
          />
          <span className="ds-radio__control" aria-hidden="true" />
          <span className="ds-radio__label">{option.label}</span>
        </label>
      ))}
    </div>
  )
}
