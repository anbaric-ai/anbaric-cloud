import './OptionsMenu.css'
import { useId, useRef, useState, type ReactNode, type ToggleEvent } from 'react'

export interface OptionsMenuItem {
  label: ReactNode
  onSelect?: () => void
  disabled?: boolean
}

export interface OptionsMenuProps {
  /** Trigger content. Defaults to a horizontal ellipsis. */
  label?: ReactNode
  /** The menu options. */
  items: OptionsMenuItem[]
  /** Which side of the trigger the menu aligns to. Defaults to "end". */
  align?: 'start' | 'end'
  className?: string
}

/**
 * OptionsMenu — a trigger that opens a popover menu of actions. Built on the
 * native Popover API: the menu lives in the top layer (so it sits above other
 * elements) and light-dismisses (outside click / Escape) for free. Position is
 * set relative to the trigger as the popover opens.
 */
export function OptionsMenu({
  label = '⋯',
  items,
  align = 'end',
  className,
}: OptionsMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const menuId = `ds-options-${useId().replace(/:/g, '')}`

  const handleBeforeToggle = (event: ToggleEvent<HTMLUListElement>) => {
    if (event.newState !== 'open') return
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return
    const rect = trigger.getBoundingClientRect()
    menu.style.top = `${rect.bottom + 8}px`
    if (align === 'end') {
      menu.style.left = 'auto'
      menu.style.right = `${window.innerWidth - rect.right}px`
    } else {
      menu.style.right = 'auto'
      menu.style.left = `${rect.left}px`
    }
  }

  const handleToggle = (event: ToggleEvent<HTMLUListElement>) => {
    const isOpen = event.newState === 'open'
    setOpen(isOpen)
    if (isOpen) {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('.ds-options__item:not(:disabled)')
        ?.focus()
    }
  }

  const handleSelect = (item: OptionsMenuItem) => {
    if (item.disabled) return
    item.onSelect?.()
    menuRef.current?.hidePopover()
  }

  return (
    <div className={['ds-options', className].filter(Boolean).join(' ')}>
      <button
        ref={triggerRef}
        type="button"
        className="ds-options__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        popoverTarget={menuId}
      >
        {label}
      </button>
      <ul
        ref={menuRef}
        id={menuId}
        popover="auto"
        className="ds-options__menu"
        role="menu"
        onBeforeToggle={handleBeforeToggle}
        onToggle={handleToggle}
      >
        {items.map((item, index) => (
          <li key={index} role="none">
            <button
              type="button"
              role="menuitem"
              className="ds-options__item"
              disabled={item.disabled}
              onClick={() => handleSelect(item)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
