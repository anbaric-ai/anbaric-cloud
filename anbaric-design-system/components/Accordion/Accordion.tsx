import './Accordion.css'
import { useId, useState, type HTMLAttributes, type ReactNode } from 'react'

export interface AccordionItem {
  /** Identifies the item: what `open` and `onToggle` speak in. */
  id: string
  title: ReactNode
  /** An optional right-aligned slot on the title row, such as a count. */
  detail?: ReactNode
  content: ReactNode
}

export interface AccordionProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onToggle'> {
  items: AccordionItem[]
  /** The ids open to begin with, when uncontrolled. */
  defaultOpen?: string[]
  /** The ids open now; supply with `onToggle` to control the accordion. */
  open?: string[]
  onToggle?: (id: string, open: boolean) => void
}

/**
 * Accordion — a stack of titled sections that open and close independently,
 * so several can be open at once. Each title row is a button carrying
 * `aria-expanded` and pointing at its panel, which is a labelled region.
 */
export function Accordion({ items, defaultOpen = [], open, onToggle, className, ...rest }: AccordionProps) {
  const [openIds, setOpenIds] = useState<string[]>(defaultOpen)
  const base = useId()
  const current = open ?? openIds

  const toggle = (id: string) => {
    const opening = !current.includes(id)
    if (open === undefined) {
      setOpenIds(opening ? [...current, id] : current.filter((each) => each !== id))
    }
    onToggle?.(id, opening)
  }

  return (
    <div className={['ds-accordion', className].filter(Boolean).join(' ')} {...rest}>
      {items.map((item) => {
        const isOpen = current.includes(item.id)
        const triggerId = `${base}-${item.id}-trigger`
        const panelId = `${base}-${item.id}-panel`
        return (
          <div
            key={item.id}
            className={['ds-accordion__item', isOpen && 'ds-accordion__item--open'].filter(Boolean).join(' ')}
          >
            <button
              type="button"
              id={triggerId}
              className="ds-accordion__trigger"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(item.id)}
            >
              <span className="ds-accordion__chevron material-symbols-rounded" aria-hidden="true">
                chevron_right
              </span>
              <span className="ds-accordion__title">{item.title}</span>
              {item.detail !== undefined ? <span className="ds-accordion__detail">{item.detail}</span> : null}
            </button>
            <div id={panelId} role="region" aria-labelledby={triggerId} hidden={!isOpen} className="ds-accordion__panel">
              {item.content}
            </div>
          </div>
        )
      })}
    </div>
  )
}
