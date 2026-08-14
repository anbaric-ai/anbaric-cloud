import { useEffect, useState } from 'react'

import { SideNav, type NavItem } from '@anbaric/design-system/components/SideNav'

interface App {
  appName: string
  status: string
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

  const items: NavItem[] = [
    { label: 'Dashboard', value: '/' },
    { label: 'Manage keys', value: '/manage-keys' },
    ...apps.map((app) => ({
      label: app.appName,
      value: `/${app.appName}`,
      disabled: app.status !== 'running',
    })),
  ]

  return (
    <SideNav
      header="Anbaric"
      items={items}
      active={window.location.pathname}
      collapsible={false}
      onChange={(value) => {
        window.location.href = value
      }}
      style={{ position: 'sticky', top: 'var(--space-lg)' }}
    />
  )
}

export { PlatformNav }
