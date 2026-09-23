import { useEffect, useState } from 'react'

import { AvatarMenu } from '@anbaric/design-system/components/AvatarMenu'

// The design system takes icons as nodes; the console's glyphs are Material
// Symbols, already loaded by the page.
const Sym = ({ name }: { name: string }) => (
  <span className="material-symbols-rounded" aria-hidden="true">{name}</span>
)

type Me = { id: string; name?: string; email?: string; picture?: string; tenant?: string }

// Shows who is signed in, with a way to sign out / switch user, on the
// standalone pages (authorize-cli, subscribe) that have no nav of their own.
// Renders nothing until it knows who you are, so it never flashes empty.
function IdentityBar() {
  const [me, setMe] = useState<Me | undefined>(undefined)

  useEffect(() => {
    void fetch('/whoami')
      .then((response) => (response.ok ? response.json() : undefined))
      .then((who: Me | undefined) => setMe(who))
      .catch(() => {})
  }, [])

  if (!me) return null

  return (
    <AvatarMenu
      name={me.name ?? me.email ?? me.id}
      subtitle={[me.tenant, me.email].filter(Boolean).join(' · ') || undefined}
      src={me.picture}
      items={[{ label: 'Sign out', onSelect: () => (window.location.href = '/logout') }]}
      action={{
        icon: <Sym name="swap_horiz" />,
        label: 'Switch tenant',
        onSelect: () => (window.location.href = '/choose-tenant'),
      }}
    />
  )
}

export { IdentityBar }
