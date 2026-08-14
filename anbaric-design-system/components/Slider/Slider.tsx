import './Slider.css'
import {
  useState,
  type ChangeEvent,
  type CSSProperties,
  type InputHTMLAttributes,
} from 'react'

export interface SliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Render tick marks at each step along the track (requires `step`). */
  showTicks?: boolean
}

/**
 * Slider — a range input with a custom thumb that shows the current value and
 * expands (mostly horizontally) on hover/focus. A real, transparent
 * `<input type="range">` sits on top for interaction and accessibility, while
 * the track, fill, thumb and optional ticks are rendered around it.
 *
 * Supports `min`, `max`, `step` and a `showTicks` option.
 */
export function Slider({
  className,
  value,
  defaultValue,
  min = 0,
  max = 100,
  step,
  onChange,
  showTicks = false,
  style,
  ...rest
}: SliderProps) {
  const [internal, setInternal] = useState(value ?? defaultValue ?? min)
  const current = Number(value ?? internal)
  const minN = Number(min)
  const maxN = Number(max)
  const frac = maxN > minN ? (current - minN) / (maxN - minN) : 0

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInternal(event.target.value)
    onChange?.(event)
  }

  const stepN = Number(step)
  const tickCount =
    showTicks && Number.isFinite(stepN) && stepN > 0
      ? Math.min(Math.round((maxN - minN) / stepN), 100) + 1
      : 0

  return (
    <div
      className={['ds-slider', className].filter(Boolean).join(' ')}
      style={{ ...style, ['--frac']: String(frac) } as CSSProperties}
    >
      <div className="ds-slider__track">
        <div className="ds-slider__fill" />
      </div>
      {tickCount > 0 ? (
        <div className="ds-slider__ticks" aria-hidden="true">
          {Array.from({ length: tickCount }, (_, i) => (
            <span key={i} className="ds-slider__tick" />
          ))}
        </div>
      ) : null}
      <div className="ds-slider__thumb" aria-hidden="true">
        {current}
      </div>
      <input
        type="range"
        className="ds-slider__input"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={handleChange}
        {...rest}
      />
    </div>
  )
}
