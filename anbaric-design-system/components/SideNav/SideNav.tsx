import './SideNav.css'
import { useState, type HTMLAttributes, type ReactNode } from 'react'

export interface NavItem {
  label: string
  value: string
  /** An icon (e.g. a Material Symbols span). Shown in both states. */
  icon?: ReactNode
  disabled?: boolean
  /** Render as a link to this URL instead of an onChange button. */
  href?: string
  /** With href: open in a new tab, marked by a trailing external-link icon. */
  external?: boolean
}

/** A labelled divider introducing a group of items. */
export interface NavSection {
  section: string
}

export type NavEntry = NavItem | NavSection

export interface SideNavProps
  extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  items: NavEntry[]
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

const isSection = (entry: NavEntry): entry is NavSection => 'section' in entry

/**
 * SideNav — a left navigation panel (elevation level 3) on the glass surface.
 * Each item carries an icon and a label; the nav collapses to an icons-only
 * rail and back. Controlled via `active` / uncontrolled via `defaultActive`.
 * Items with an `href` render as links; `external` ones open in a new tab.
 * `{ section }` entries draw a labelled divider between groups.
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

  const itemClassName = (item: NavItem) =>
    [
      'ds-sidenav__item',
      item.value === current && 'ds-sidenav__item--active',
      item.disabled && 'ds-sidenav__item--disabled',
    ]
      .filter(Boolean)
      .join(' ')

  const itemContent = (item: NavItem) => (
    <>
      {item.icon ? <span className="ds-sidenav__icon">{item.icon}</span> : null}
      <span className="ds-sidenav__label">{item.label}</span>
      {item.external ? (
        <span
          className="ds-sidenav__external material-symbols-rounded"
          aria-hidden="true"
        >
          open_in_new
        </span>
      ) : null}
    </>
  )

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
        {items.map((entry) =>
          isSection(entry) ? (
            <li
              key={`section:${entry.section}`}
              className="ds-sidenav__section"
              role="presentation"
            >
              <hr className="ds-sidenav__rule" aria-hidden="true" />
              <span className="ds-sidenav__section-label">{entry.section}</span>
            </li>
          ) : (
            <li key={entry.value}>
              {entry.href ? (
                <a
                  className={itemClassName(entry)}
                  href={entry.disabled ? undefined : entry.href}
                  target={entry.external ? '_blank' : undefined}
                  rel={entry.external ? 'noreferrer' : undefined}
                  aria-current={entry.value === current ? 'page' : undefined}
                  aria-label={entry.label}
                  aria-disabled={entry.disabled || undefined}
                  title={collapsed ? entry.label : undefined}
                >
                  {itemContent(entry)}
                </a>
              ) : (
                <button
                  type="button"
                  className={itemClassName(entry)}
                  aria-current={entry.value === current ? 'page' : undefined}
                  aria-label={entry.label}
                  title={collapsed ? entry.label : undefined}
                  disabled={entry.disabled}
                  onClick={() => select(entry.value)}
                >
                  {itemContent(entry)}
                </button>
              )}
            </li>
          ),
        )}
      </ul>
    </nav>
  )
}
