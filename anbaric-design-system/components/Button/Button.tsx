import './Button.css'
import { type ButtonHTMLAttributes, type ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Show a spinner and block interaction. */
  loading?: boolean
  iconStart?: ReactNode
  iconEnd?: ReactNode
  fullWidth?: boolean
}

/**
 * Button — the primary action component. Variants (primary / secondary / ghost
 * / danger), sizes, a loading state, and optional start/end icons. Lifts on
 * hover, presses on click, sweeps a sheen, and shows a chunky focus ring — all
 * token-driven, and respectful of `prefers-reduced-motion`.
 */
export function Button({
  variant = 'primary',
  loading = false,
  iconStart,
  iconEnd,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        'ds-button',
        `ds-button--${variant}`,
        fullWidth && 'ds-button--full',
        loading && 'ds-button--loading',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="ds-button__spinner" aria-hidden="true" /> : null}
      {iconStart ? (
        <span className="ds-button__icon" aria-hidden="true">
          {iconStart}
        </span>
      ) : null}
      {children ? <span className="ds-button__label">{children}</span> : null}
      {iconEnd ? (
        <span className="ds-button__icon" aria-hidden="true">
          {iconEnd}
        </span>
      ) : null}
    </button>
  )
}
