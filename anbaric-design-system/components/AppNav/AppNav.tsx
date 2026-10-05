import './AppNav.css'
import { type ReactNode } from 'react'

import { SideNav, type NavEntry } from '../SideNav'
import { AvatarMenu, type AvatarMenuAction, type AvatarMenuItem } from '../AvatarMenu'
import { BuiltWithAnbaric } from '../BuiltWithAnbaric'
import identUrl from '../../shared/assets/anbaric-ident.svg'

export interface AppNavAccount {
  /** The signed-in identity — shown in the account menu; initials as fallback. */
  name: string
  subtitle?: ReactNode
  src?: string
  items: AvatarMenuItem[]
  /** An icon button beside the identity, at the foot of the account menu. */
  action?: AvatarMenuAction
}

export interface AppNavProps {
  items: NavEntry[]
  active?: string
  onChange?: (value: string) => void
  /**
   * The account shown at the foot of the rail — the console's variant, where
   * there is an identity to show and a menu of things it can do. Leave it out
   * in an app built on Anbaric: the foot then carries the "Built with Anbaric"
   * attribution instead, and the app never has to invent an account menu it
   * has nothing to put in.
   */
  account?: AppNavAccount
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

/**
 * AppNav — the Anbaric application rail: the mark, the navigation, and at the
 * foot either the account menu (the console) or the "Built with Anbaric" line
 * (an app), as one full-height floating rail hugging the screen edge. The
 * single component behind every left nav, so the chrome never diverges.
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
        account ? (
          <AvatarMenu
            name={account.name}
            subtitle={account.subtitle}
            src={account.src}
            items={account.items}
            action={account.action}
          />
        ) : (
          <BuiltWithAnbaric className="ds-app-nav__built-with" />
        )
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
