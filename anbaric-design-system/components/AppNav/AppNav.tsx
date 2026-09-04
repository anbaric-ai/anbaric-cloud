import './AppNav.css'
import { type ReactNode } from 'react'

import { SideNav, type NavEntry } from '../SideNav'
import { AvatarMenu, type AvatarMenuItem } from '../AvatarMenu'
import identUrl from '../../shared/assets/anbaric-ident.svg'

export interface AppNavAccount {
  /** The signed-in identity — shown in the account menu; initials as fallback. */
  name: string
  subtitle?: ReactNode
  src?: string
  items: AvatarMenuItem[]
}

export interface AppNavProps {
  items: NavEntry[]
  active?: string
  onChange?: (value: string) => void
  /** The account shown at the foot of the rail. */
  account: AppNavAccount
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

/**
 * AppNav — the Anbaric application rail: the mark, the navigation, and the
 * account menu, as one full-height floating rail hugging the screen edge. The
 * single component behind every app's left nav, so the chrome never diverges.
 */
export function AppNav({
  items,
  active,
  onChange,
  account,
  collapsed,
  defaultCollapsed,
  onCollapsedChange,
}: AppNavProps) {
  return (
    <SideNav
      className="ds-app-nav"
      header={<img className="ds-app-nav__mark" src={identUrl} alt="Anbaric" />}
      footer={
        <AvatarMenu
          name={account.name}
          subtitle={account.subtitle}
          src={account.src}
          items={account.items}
        />
      }
      items={items}
      active={active}
      onChange={onChange}
      collapsed={collapsed}
      defaultCollapsed={defaultCollapsed}
      onCollapsedChange={onCollapsedChange}
    />
  )
}
