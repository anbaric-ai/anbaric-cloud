import './Button.css'
import { type ButtonHTMLAttributes, type ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Show a spinner and block interaction. */
  loading?: boolean
  iconStart?: ReactNode
  iconEnd?: ReactNode
  fullWidth?: boolean
}

/**
 * Button — the action component. Variants: primary (ink), secondary (white,
 * bordered - the action beside a primary), ghost (text only, coral) and
 * danger. A loading state, optional start/end icons. Flat: hover and press
 * are told by colour, focus by the shared ring.
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
