import './Steps.css'
import { type HTMLAttributes } from 'react'

export interface StepsProps extends HTMLAttributes<HTMLOListElement> {
  /** Ordered step labels. */
  steps: string[]
  /** Index of the current step (0-based). Earlier steps read as done. */
  current: number
}

/**
 * Steps — a numbered, named wizard progress indicator. Steps before `current`
 * are marked done, the current step is highlighted, and later steps are muted.
 */
export function Steps({ steps, current, className, ...rest }: StepsProps) {
  return (
    <ol className={['ds-steps', className].filter(Boolean).join(' ')} {...rest}>
      {steps.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'upcoming'
        return (
          <li
            key={label + i}
            className={`ds-steps__step ds-steps__step--${state}`}
            aria-current={i === current ? 'step' : undefined}
          >
            <span className="ds-steps__marker">{i < current ? '✓' : i + 1}</span>
            <span className="ds-steps__label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
