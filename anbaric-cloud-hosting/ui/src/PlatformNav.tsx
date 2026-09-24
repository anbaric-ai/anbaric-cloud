import { useEffect, useState } from 'react'

import { AppNav } from '@anbaric/design-system/components/AppNav'
import type { NavEntry } from '@anbaric/design-system/components/SideNav'

import { registry } from './plugins/PluginRegistry'

interface App {
  appName: string
  status: string
}

const appUrl = (appName: string, user: CurrentUser | undefined): string =>
  user?.appHostSuffix && user.tenant
    ? `https://${appName}--${user.tenant}.${user.appHostSuffix}`
    : `/app/${appName}`

interface CurrentUser {
  id: string
  roles: string[]
  name?: string
  picture?: string
  tenant?: string
  tenantRole?: string
  // The domain under which each app has a hostname of its own. Sent by the
  // platform rather than guessed from the browser's address, because only the
  // platform knows whether wildcard DNS exists for it.
  appHostSuffix?: string
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
            href: appUrl(app.appName, user),
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
