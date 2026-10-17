import { useEffect, useState } from 'react'

import { Alert } from '@anbaric/design-system/components/Alert'
import { Button } from '@anbaric/design-system/components/Button'
import { EmptyState } from '@anbaric/design-system/components/EmptyState'
import { Skeleton } from '@anbaric/design-system/components/Skeleton'
import { Table } from '@anbaric/design-system/components/Table'

interface CliKey {
  id: string
  clientName: string
  createdAt: string
}

function ManageKeysPage() {
  const [keys, setKeys] = useState<CliKey[] | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  const refresh = async () => {
    const response = await fetch('/api/v2/keys')
    if (!response.ok) {
      setFailed(true)
      return
    }
    setKeys(await response.json())
  }

  useEffect(() => {
    void refresh()
  }, [])

  const revoke = async (id: string) => {
    await fetch(`/api/v2/keys/${encodeURIComponent(id)}`, { method: 'DELETE' })
    await refresh()
  }

  if (failed) {
    return (
      <Alert variant="danger" title="Could not load your keys">
        The platform rejected the request — try reloading the page.
      </Alert>
    )
  }

  if (!keys) return <Skeleton lines={4} />

  return (
    <Table
      label="CLI keys"
      rows={keys}
      rowKey={(key) => key.id}
      empty={
        <EmptyState icon="key" title="No CLI keys yet">
          Run <code>anbaric login</code> in a terminal to authorize one.
        </EmptyState>
      }
      columns={[
        { id: 'client', header: 'Client', primary: true, cell: (key) => <strong>{key.clientName}</strong> },
        { id: 'id', header: 'Key', mono: true, muted: true, cell: (key) => key.id },
        { id: 'issued', header: 'Issued', muted: true, cell: (key) => new Date(key.createdAt).toLocaleString() },
        {
          id: 'revoke',
          header: '',
          align: 'right',
          cell: (key) => (
            <Button variant="ghost" onClick={() => void revoke(key.id)}>
              Revoke
            </Button>
          ),
        },
      ]}
    />
  )
}

export { ManageKeysPage }
