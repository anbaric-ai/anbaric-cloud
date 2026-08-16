import { useEffect, useState } from 'react'

import { SideNav, type NavEntry } from '@anbaric/design-system/components/SideNav'
import logoUrl from '@anbaric/design-system/shared/assets/anbaric-logo.svg'

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

function PlatformNav() {
  const [apps, setApps] = useState<App[]>([])

  useEffect(() => {
    void fetch('/apps')
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
            value: `/${app.appName}`,
            href: `/${app.appName}`,
            external: true,
            icon: <Sym name="deployed_code" />,
            disabled: app.status !== 'running',
          })),
        ]

  const items: NavEntry[] = [
    { label: 'Dashboard', value: '/', icon: <Sym name="dashboard" /> },
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
          style={{ height: '1.05rem', display: 'block', width: 'auto' }}
        />
      }
      items={items}
      active={window.location.pathname}
      onChange={(value) => {
        window.location.href = value
      }}
      style={{ position: 'sticky', top: 'var(--space-lg)', flex: 'none' }}
    />
  )
}

export { PlatformNav }
