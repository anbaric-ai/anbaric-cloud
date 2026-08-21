import { useEffect, useState } from 'react'

import { Card } from '@anbaric/design-system/components/Card'
import { Button } from '@anbaric/design-system/components/Button'
import { Alert } from '@anbaric/design-system/components/Alert'

interface CliKey {
  id: string
  clientName: string
  createdAt: string
}

function ManageKeysPage() {
  const [keys, setKeys] = useState<CliKey[] | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  const refresh = async () => {
    const response = await fetch('/keys')
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
    await fetch(`/keys/${encodeURIComponent(id)}`, { method: 'DELETE' })
    await refresh()
  }

  return (
    <>
      {failed ? (
        <Alert variant="danger" title="Could not load your keys">
          The platform rejected the request — try reloading the page.
        </Alert>
      ) : null}
      {keys && keys.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>
            No CLI keys yet. Run <code>anbaric login</code> in a terminal to
            authorize one.
          </p>
        </Card>
      ) : null}
      {(keys ?? []).map((key) => (
        <Card key={key.id}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-md)',
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{key.clientName}</p>
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  color: 'var(--color-foreground-tint-2)',
                }}
              >
                {key.id} · issued {new Date(key.createdAt).toLocaleString()}
              </p>
            </div>
            <Button variant="danger" onClick={() => void revoke(key.id)}>
              Revoke
            </Button>
          </div>
        </Card>
      ))}
    </>
  )
}

export { ManageKeysPage }
