import './AvatarMenu.css'
import { useId, useRef, useState, type ReactNode, type ToggleEvent } from 'react'

export interface AvatarMenuItem {
  label: ReactNode
  onSelect?: () => void
  disabled?: boolean
}

export interface AvatarMenuProps {
  /** The person's name — shown in the menu and used for the initials fallback. */
  name: string
  /** Optional second line in the menu (an email, a role). */
  subtitle?: ReactNode
  /** An avatar image. Falls back to the initials of `name`. */
  src?: string
  /** The menu actions. */
  items: AvatarMenuItem[]
  className?: string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)
  return letters.toUpperCase()
}

function Avatar({ name, src }: { name: string; src?: string }) {
  return (
    <span className="ds-avatar" aria-hidden="true">
      {src ? (
        <img className="ds-avatar__img" src={src} alt="" />
      ) : (
        <span className="ds-avatar__initials">{initials(name)}</span>
      )}
    </span>
  )
}

/**
 * AvatarMenu — a person's avatar that opens a popover account menu. The menu's
 * own avatar sits at its foot, positioned to land exactly over the trigger
 * avatar: the panel is centred on the avatar and fades in above it (opacity
 * only, no movement), so the avatar itself never appears to shift. Built on the
 * native Popover API — top layer, light-dismiss for free.
 */
export function AvatarMenu({ name, subtitle, src, items, className }: AvatarMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = `ds-avatar-${useId().replace(/:/g, '')}`

  const place = (event: ToggleEvent<HTMLDivElement>) => {
    if (event.newState !== 'open') return
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return
    const t = trigger.getBoundingClientRect()
    const cs = getComputedStyle(menu)
    const width = parseFloat(cs.width)
    const padLeft = parseFloat(cs.paddingLeft)
    const padBottom = parseFloat(cs.paddingBottom)
    // Drop the panel's own foot-avatar exactly over the trigger (same size, same
    // place) so it reads as the same avatar; the panel grows up and to the right.
    const left = t.left - padLeft
    menu.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`
    menu.style.right = 'auto'
    menu.style.top = 'auto'
    menu.style.bottom = `${window.innerHeight - t.bottom - padBottom}px`
  }

  const handleToggle = (event: ToggleEvent<HTMLDivElement>) => {
    const isOpen = event.newState === 'open'
    setOpen(isOpen)
    if (isOpen) {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('.ds-avatar-menu__item:not(:disabled)')
        ?.focus()
    }
  }

  const handleSelect = (item: AvatarMenuItem) => {
    if (item.disabled) return
    item.onSelect?.()
    menuRef.current?.hidePopover()
  }

  return (
    <div className={['ds-avatar-menu', className].filter(Boolean).join(' ')}>
      <button
        ref={triggerRef}
        type="button"
        className="ds-avatar-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name}
        popoverTarget={menuId}
      >
        <Avatar name={name} src={src} />
      </button>
      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        className="ds-avatar-menu__menu"
        onBeforeToggle={place}
        onToggle={handleToggle}
      >
        <ul className="ds-avatar-menu__list" role="menu">
          {items.map((item, index) => (
            <li key={index} role="none">
              <button
                type="button"
                role="menuitem"
                className="ds-avatar-menu__item"
                disabled={item.disabled}
                onClick={() => handleSelect(item)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <hr className="ds-avatar-menu__rule" />
        <div className="ds-avatar-menu__foot">
          <Avatar name={name} src={src} />
          <div className="ds-avatar-menu__identity">
            <span className="ds-avatar-menu__name">{name}</span>
            {subtitle != null ? (
              <span className="ds-avatar-menu__subtitle">{subtitle}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
