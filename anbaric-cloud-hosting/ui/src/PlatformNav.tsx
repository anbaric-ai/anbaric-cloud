import { useEffect, useState } from 'react'

import { SideNav, type NavEntry } from '@anbaric/design-system/components/SideNav'
import logoUrl from '@anbaric/design-system/shared/assets/anbaric-ident.svg'

import { registry } from './plugins/PluginRegistry'

interface App {
  appName: string
  status: string
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

  useEffect(() => {
    void fetch('/api/v2/apps')
      .then(async (response) => {
        if (response.ok) setApps(await response.json())
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
    { label: 'Manage keys', value: '/manage-keys', icon: <Sym name="key" /> },
    ...appEntries,
  ]

  return (
    <SideNav
      header={
        <img
          src={logoUrl}
          alt="Anbaric"
          style={{ height: '1.6rem', display: 'block', width: 'auto' }}
        />
      }
      items={items}
      active={active}
      onChange={(value) => navigate(value)}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      style={{ position: 'sticky', top: 'var(--space-lg)', flex: 'none' }}
    />
  )
}

export { PlatformNav }
