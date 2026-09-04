import { useEffect, useState } from 'react'

import { AppNav } from '@anbaric/design-system/components/AppNav'
import type { NavEntry } from '@anbaric/design-system/components/SideNav'

import { registry } from './plugins/PluginRegistry'

interface App {
  appName: string
  status: string
}

interface CurrentUser {
  id: string
  roles: string[]
  name?: string
  picture?: string
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
            href: `/app/${app.appName}`,
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

  const items: NavEntry[] = [
    ...pageEntries,
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
        subtitle: user && user.roles.length > 0 ? user.roles.join(' · ') : undefined,
        src: user?.picture,
        items: [
          { label: 'Manage keys', onSelect: () => navigate('/manage-keys') },
          { label: 'Sign out', onSelect: () => (window.location.href = '/logout') },
        ],
      }}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
    />
  )
}

export { PlatformNav }
