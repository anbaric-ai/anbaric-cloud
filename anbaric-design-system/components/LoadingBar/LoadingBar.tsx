import './LoadingBar.css'
import { useEffect, useState, type HTMLAttributes } from 'react'

const DEFAULT_MESSAGES = [
  'Warming up the model…',
  'Reading the molecules…',
  'Crunching the numbers…',
  'Folding proteins…',
  'Almost there…',
]

export type LoadingBarVariant = 'brand' | 'plain'

export interface LoadingBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Messages cycled beneath the bar while loading. */
  messages?: string[]
  /** Milliseconds between message changes. Defaults to 2600. */
  interval?: number
  /**
   * `brand` flows the full brand gradient — for a moment that is the product
   * showing off (an AI request). `plain` is the primary colour alone with the
   * sheen — for waiting that should feel calm (provisioning, a redirect).
   */
  variant?: LoadingBarVariant
}

/**
 * LoadingBar — an indeterminate progress bar with a sweeping sheen, flowing the
 * brand gradient or a single colour, plus status messages that cycle through
 * while a long task (e.g. an AI request) runs.
 */
export function LoadingBar({
  messages = DEFAULT_MESSAGES,
  interval = 2600,
  variant = 'brand',
  className,
  ...rest
}: LoadingBarProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (messages.length <= 1) return
    const id = setInterval(
      () => setIndex((prev) => (prev + 1) % messages.length),
      interval,
    )
    return () => clearInterval(id)
  }, [messages, interval])

  return (
    <div
      className={['ds-loading', `ds-loading--${variant}`, className].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
      {...rest}
    >
      <div className="ds-loading__bar">
        <div className="ds-loading__flow" />
      </div>
      {messages.length > 0 ? (
        <span key={index} className="ds-loading__message">
          {messages[index]}
        </span>
      ) : null}
    </div>
  )
}
