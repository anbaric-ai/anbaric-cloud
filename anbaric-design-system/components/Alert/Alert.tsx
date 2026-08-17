import './Alert.css'
import { type HTMLAttributes, type ReactNode } from 'react'

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger'

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: AlertVariant
  title?: ReactNode
  /** Override the default icon (a Material Symbol name otherwise). */
  icon?: ReactNode
  /** Show a dismiss button that calls this. */
  onDismiss?: () => void
  children?: ReactNode
}

const ICONS: Record<AlertVariant, string> = {
  info: 'info',
  success: 'check_circle',
  warning: 'warning',
  danger: 'error',
}

/**
 * Alert — an inline status message in one of the semantic tones. Danger uses
 * role="alert" (assertive); the rest use role="status".
 */
export function Alert({
  variant = 'info',
  title,
  icon,
  onDismiss,
  children,
  className,
  ...rest
}: AlertProps) {
  return (
    <div
      className={['ds-alert', `ds-alert--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
      role={variant === 'danger' ? 'alert' : 'status'}
      {...rest}
    >
      <span className="ds-alert__icon material-symbols-rounded" aria-hidden="true">
        {icon ?? ICONS[variant]}
      </span>
      <div className="ds-alert__content">
        {title ? <p className="ds-alert__title">{title}</p> : null}
        {children ? <div className="ds-alert__body">{children}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="ds-alert__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <span className="material-symbols-rounded" aria-hidden="true">
            close
          </span>
        </button>
      ) : null}
    </div>
  )
}
