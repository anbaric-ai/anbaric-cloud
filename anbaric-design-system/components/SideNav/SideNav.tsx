import './SideNav.css'
import { useEffect, useState, type HTMLAttributes, type ReactNode, type SyntheticEvent } from 'react'

import { useMediaQuery } from '../useMediaQuery'

export interface NavItem {
  label: string
  value: string
  /** An icon (e.g. a Material Symbols span). Shown in both states. */
  icon?: ReactNode
  disabled?: boolean
  /** A trailing count or label, right-aligned (e.g. an unread count). */
  badge?: ReactNode
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
  /** Optional footer pinned to the bottom of the rail (e.g. an account menu). */
  footer?: ReactNode
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

/** The width below which the nav behaves as a rail and a drawer. */
export const SIDENAV_NARROW_QUERY = '(max-width: 40rem)'

const isSection = (entry: NavEntry): entry is NavSection => 'section' in entry

/**
 * SideNav — a left navigation panel (elevation level 3) on the glass surface.
 * Each item carries an icon and a label; the nav collapses to an icons-only
 * rail and back. Controlled via `active` / uncontrolled via `defaultActive`.
 * Items with an `href` render as links; `external` ones open in a new tab.
 * `{ section }` entries draw a labelled divider between groups.
 *
 * On a narrow screen the collapsed nav is a slim rail flush with the screen
 * edge, and a tap anywhere on it - an icon, the mark, the account - opens the
 * nav as a drawer over the page rather than acting on what was tapped. Picking
 * an item, tapping the backdrop or pressing Escape closes it again.
 */
export function SideNav({
  items,
  header,
  footer,
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
  const narrow = useMediaQuery(SIDENAV_NARROW_QUERY)

  // A rail that only opens, and a drawer that is open.
  const peek = narrow && collapsed
  const drawer = narrow && !collapsed

  const setCollapsed = (next: boolean) => {
    setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }

  const toggleCollapsed = () => setCollapsed(!collapsed)

  const select = (value: string) => {
    setInternal(value)
    onChange?.(value)
    // The drawer has done its job once something is picked from it.
    if (narrow) setCollapsed(true)
    // Bring the freshly selected view into view from the top.
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    if (!drawer) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCollapsed(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer])

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
      {item.badge != null ? (
        <span className="ds-sidenav__badge">{item.badge}</span>
      ) : null}
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

  /* In the rail every item is a button that opens the drawer, whatever it
     would otherwise do: a tap on a slim rail means "show me the navigation",
     not "take me to this one". Links and disabled items alike. */
  const renderItem = (entry: NavItem) => {
    if (peek) {
      return (
        <button
          type="button"
          className={itemClassName(entry)}
          aria-label={`Open navigation (${entry.label})`}
          title={entry.label}
          onClick={toggleCollapsed}
        >
          {itemContent(entry)}
        </button>
      )
    }
    if (entry.href) {
      return (
        <a
          className={itemClassName(entry)}
          href={entry.disabled ? undefined : entry.href}
          target={entry.external ? '_blank' : undefined}
          rel={entry.external ? 'noreferrer' : undefined}
          aria-current={entry.value === current ? 'page' : undefined}
          aria-label={entry.label}
          aria-disabled={entry.disabled || undefined}
          title={collapsed ? entry.label : undefined}
          onClick={narrow ? () => setCollapsed(true) : undefined}
        >
          {itemContent(entry)}
        </a>
      )
    }
    return (
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
    )
  }

  // In the rail the footer's own control (an account menu, say) must not
  // fire: the tap opens the drawer instead, where the control works as usual.
  const openInsteadOf = (event: SyntheticEvent) => {
    if (!peek) return
    event.preventDefault()
    event.stopPropagation()
    toggleCollapsed()
  }

  return (
    <>
      {drawer ? (
        <div
          className="ds-sidenav__backdrop"
          onClick={() => setCollapsed(true)}
          aria-hidden="true"
        />
      ) : null}
      <nav
        className={[
          'ds-sidenav',
          collapsed && 'ds-sidenav--collapsed',
          peek && 'ds-sidenav--peek',
          drawer && 'ds-sidenav--drawer',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={peek ? toggleCollapsed : undefined}
        {...rest}
      >
        {header || collapsible ? (
          <div className="ds-sidenav__top">
            {header ? <span className="ds-sidenav__header">{header}</span> : null}
            {collapsible ? (
              <button
                type="button"
                className="ds-sidenav__toggle"
                onClick={(event) => {
                  event.stopPropagation()
                  toggleCollapsed()
                }}
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
              <li key={entry.value}>{renderItem(entry)}</li>
            ),
          )}
        </ul>

        {footer ? (
          <div className="ds-sidenav__footer" onClickCapture={openInsteadOf}>
            {footer}
          </div>
        ) : null}
      </nav>
    </>
  )
}
