import './BuiltWithAnbaric.css'
import { type HTMLAttributes } from 'react'

import identUrl from '../../shared/assets/anbaric-ident.svg'

export interface BuiltWithAnbaricProps extends HTMLAttributes<HTMLElement> {
  /** Where the label links to. */
  href?: string
}

/**
 * BuiltWithAnbaric — a small, quiet attribution for the foot of a page or the
 * bottom of a nav: the ident (Asriel Ink) at text height and the words "Built
 * with Anbaric", in a muted foreground tint. Sized and toned to sit beneath
 * the app's own UI rather than compete with it.
 */
export function BuiltWithAnbaric({ href = 'https://anbaric.ai', className, ...rest }: BuiltWithAnbaricProps) {
  return (
    <a
      className={['ds-built-with', className].filter(Boolean).join(' ')}
      href={href}
      target="_blank"
      rel="noopener"
      {...rest}
    >
      <img className="ds-built-with__ident" src={identUrl} alt="" aria-hidden="true" />
      <span>Built with Anbaric</span>
    </a>
  )
}
