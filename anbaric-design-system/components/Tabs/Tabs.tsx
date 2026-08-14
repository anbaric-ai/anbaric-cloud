import './Tabs.css'
import {
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

export interface TabItem {
  label: string
  content: ReactNode
}

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  tabs: TabItem[]
  /** Initially selected tab index. Defaults to 0. */
  defaultIndex?: number
}

/**
 * Tabs — a tab list and panels following the ARIA tabs pattern. Click or use
 * Arrow / Home / End keys to switch tabs.
 */
export function Tabs({ tabs, defaultIndex = 0, className, ...rest }: TabsProps) {
  const [active, setActive] = useState(defaultIndex)
  const base = useId()
  const listRef = useRef<HTMLDivElement>(null)

  const move = (to: number) => {
    const next = (to + tabs.length) % tabs.length
    setActive(next)
    const buttons = listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')
    buttons?.[next]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        move(active + 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        move(active - 1)
        break
      case 'Home':
        event.preventDefault()
        move(0)
        break
      case 'End':
        event.preventDefault()
        move(tabs.length - 1)
        break
      default:
    }
  }

  return (
    <div className={['ds-tabs', className].filter(Boolean).join(' ')} {...rest}>
      <div ref={listRef} role="tablist" className="ds-tabs__list" onKeyDown={onKeyDown}>
        {tabs.map((tab, i) => (
          <button
            key={tab.label + i}
            type="button"
            role="tab"
            id={`${base}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${base}-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            className={[
              'ds-tabs__tab',
              i === active && 'ds-tabs__tab--active',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActive(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.label + i}
          role="tabpanel"
          id={`${base}-panel-${i}`}
          aria-labelledby={`${base}-tab-${i}`}
          hidden={i !== active}
          className="ds-tabs__panel"
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}
