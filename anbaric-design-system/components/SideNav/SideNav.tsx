import './SideNav.css'
import { useState, type HTMLAttributes, type ReactNode } from 'react'

export interface NavItem {
  label: string
  value: string
  /** An icon (e.g. a Material Symbols span). Shown in both states. */
  icon?: ReactNode
  disabled?: boolean
}

export interface SideNavProps
  extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  items: NavItem[]
  /** Optional header (brand, title) above the items. Hidden when collapsed. */
  header?: ReactNode
  /** Active item value (controlled). */
  active?: string
  /** Initial active item value (uncontrolled). */
  defaultActive?: string
  onChange?: (value: string) => void
  /** Show a toggle to collapse the nav to icons only. Defaults to true. */
  collapsible?: boolean
  /** Collapsed state (controlled). */
  collapsed?: boolean
  /** Start collapsed (uncontrolled). */
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

/**
 * SideNav — a left navigation panel (elevation level 3) on the glass surface.
 * Each item carries an icon and a label; the nav collapses to an icons-only
 * rail and back. Controlled via `active` / uncontrolled via `defaultActive`.
 */
export function SideNav({
  items,
  header,
  active,
  defaultActive,
  onChange,
  collapsible = true,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  className,
  ...rest
}: SideNavProps) {
  const [internal, setInternal] = useState(defaultActive ?? '')
  const current = active ?? internal
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed)
  const collapsed = collapsedProp ?? internalCollapsed

  const select = (value: string) => {
    setInternal(value)
    onChange?.(value)
    // Bring the freshly selected view into view from the top.
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const toggleCollapsed = () => {
    const next = !collapsed
    setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }

  return (
    <nav
      className={['ds-sidenav', collapsed && 'ds-sidenav--collapsed', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {header || collapsible ? (
        <div className="ds-sidenav__top">
          {header ? <span className="ds-sidenav__header">{header}</span> : null}
          {collapsible ? (
            <button
              type="button"
              className="ds-sidenav__toggle"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              aria-expanded={!collapsed}
            >
              <span className="material-symbols-rounded" aria-hidden="true">
                {collapsed ? 'menu' : 'menu_open'}
              </span>
            </button>
          ) : null}
        </div>
      ) : null}

      <ul className="ds-sidenav__list">
        {items.map((item) => (
          <li key={item.value}>
            <button
              type="button"
              className={[
                'ds-sidenav__item',
                item.value === current && 'ds-sidenav__item--active',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={item.value === current ? 'page' : undefined}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
              disabled={item.disabled}
              onClick={() => select(item.value)}
            >
              {item.icon ? (
                <span className="ds-sidenav__icon">{item.icon}</span>
              ) : null}
              <span className="ds-sidenav__label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
