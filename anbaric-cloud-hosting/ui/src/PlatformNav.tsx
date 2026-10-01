import { useEffect, useState } from 'react'

import { AppNav } from '@anbaric/design-system/components/AppNav'
import type { NavEntry } from '@anbaric/design-system/components/SideNav'

import { registry } from './plugins/PluginRegistry'

import { appUrl, type CurrentUser } from './appUrl'

interface App {
  appName: string
  status: string
  subdomain?: string
  url?: string
}

function Sym({ name }: { name: string }) {
  return (
    <span className="material-symbols-rounded" aria-hidden="true">
      {name}
    </span>
  )
}

function PlatformNav({
  active,
  navigate,
  collapsed,
  onCollapsedChange,
}: {
  active: string
  navigate: (to: string) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}) {
  const [apps, setApps] = useState<App[]>([])
  const [user, setUser] = useState<CurrentUser | undefined>(undefined)

  useEffect(() => {
    void fetch('/api/v2/apps')
      .then(async (response) => {
        if (response.ok) setApps(await response.json())
      })
      .catch(() => {})
    void fetch('/api/v2/whoami')
      .then(async (response) => {
        if (response.ok) setUser(await response.json())
      })
      .catch(() => {})
  }, [])

  const appEntries: NavEntry[] =
    apps.length === 0
      ? []
      : [
          { section: 'Apps' },
          ...apps.map((app) => ({
            label: app.appName,
            value: `/app/${app.appName}`,
            // An app's own hostname serves it at the root, so links, assets and
            // fetches inside it behave as they did on the machine it was built
            // on. Fall back to the path form where there is no such domain.
            href: appUrl(app),
            external: true,
            icon: <Sym name="deployed_code" />,
            disabled: app.status !== 'running',
          })),
        ]

  const pageEntries: NavEntry[] = registry().pages.map((page) => ({
    label: page.title,
    value: page.path,
    icon: <Sym name={page.icon ?? 'widgets'} />,
  }))

  /* An undefined role means this platform is not enforcing roles at all - a
     self-hosted or local install, where everyone may build. Asking whether the
     role permits building would hide the page from every one of them. */
  const mayBuild = user === undefined
    || user.tenantRole === undefined
    || ['OWNER', 'ADMIN', 'BUILDER'].includes(user.tenantRole)

  const items: NavEntry[] = [
    ...pageEntries,
    ...(mayBuild ? [{ label: 'Manage apps', value: '/manage-apps', icon: <Sym name="deployed_code" /> }] : []),
    { label: 'Audit', value: '/audit', icon: <Sym name="history" /> },
    ...appEntries,
  ]

  return (
    <AppNav
      items={items}
      active={active}
      onChange={(value) => navigate(value)}
      account={{
        name: user?.name ?? user?.id ?? 'Account',
        subtitle: user ? [user.tenant, user.tenantRole].filter(Boolean).join(' · ') || undefined : undefined,
        src: user?.picture,
        items: [
          { label: 'Manage keys', onSelect: () => navigate('/manage-keys') },
          { label: 'Sign out', onSelect: () => (window.location.href = '/logout') },
        ],
        action: {
          icon: <Sym name="swap_horiz" />,
          label: 'Switch tenant',
          onSelect: () => (window.location.href = '/choose-tenant'),
        },
      }}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
    />
  )
}

export { PlatformNav }
