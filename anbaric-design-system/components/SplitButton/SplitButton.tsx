import './SplitButton.css'
import {
  useId,
  useRef,
  useState,
  type ReactNode,
  type ToggleEvent,
} from 'react'
import { Button, type ButtonVariant } from '../Button'

export interface SplitButtonItem {
  label: ReactNode
  onSelect?: () => void
  disabled?: boolean
}

export interface SplitButtonProps {
  /** The primary action's label. */
  children: ReactNode
  /** The primary action. */
  onClick?: () => void
  /** Secondary actions, shown in the connected dropdown. */
  items: SplitButtonItem[]
  variant?: ButtonVariant
  disabled?: boolean
  className?: string
}

/**
 * SplitButton — a primary action with a connected dropdown of secondary
 * actions. The dropdown is a native Popover (top layer, light-dismiss).
 */
export function SplitButton({
  children,
  onClick,
  items,
  variant = 'primary',
  disabled,
  className,
}: SplitButtonProps) {
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const menuId = `ds-split-${useId().replace(/:/g, '')}`

  const handleBeforeToggle = (event: ToggleEvent<HTMLUListElement>) => {
    if (event.newState !== 'open') return
    const trigger = toggleRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return
    const rect = trigger.getBoundingClientRect()
    menu.style.top = `${rect.bottom + 6}px`
    menu.style.left = 'auto'
    menu.style.right = `${window.innerWidth - rect.right}px`
  }

  const handleToggle = (event: ToggleEvent<HTMLUListElement>) => {
    const isOpen = event.newState === 'open'
    setOpen(isOpen)
    if (isOpen) {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('.ds-split__item:not(:disabled)')
        ?.focus()
    }
  }

  const handleSelect = (item: SplitButtonItem) => {
    if (item.disabled) return
    item.onSelect?.()
    menuRef.current?.hidePopover()
  }

  return (
    <div className={['ds-split', className].filter(Boolean).join(' ')}>
      <Button
        variant={variant}
        disabled={disabled}
        className="ds-split__main"
        onClick={onClick}
      >
        {children}
      </Button>
      <button
        ref={toggleRef}
        type="button"
        disabled={disabled}
        className={['ds-button', `ds-button--${variant}`, 'ds-split__toggle']
          .filter(Boolean)
          .join(' ')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        popoverTarget={menuId}
      >
        <svg
          className="ds-split__caret"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <ul
        ref={menuRef}
        id={menuId}
        popover="auto"
        className="ds-split__menu"
        role="menu"
        onBeforeToggle={handleBeforeToggle}
        onToggle={handleToggle}
      >
        {items.map((item, index) => (
          <li key={index} role="none">
            <button
              type="button"
              role="menuitem"
              className="ds-split__item"
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
