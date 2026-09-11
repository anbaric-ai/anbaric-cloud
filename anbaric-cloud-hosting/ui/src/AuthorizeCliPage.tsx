import { useEffect, useState, type CSSProperties } from 'react'

import { Card } from '@anbaric/design-system/components/Card'
import { Form } from '@anbaric/design-system/components/Form'
import { Alert } from '@anbaric/design-system/components/Alert'

import { PageShell } from './PageShell'
import { SubscribePage } from './SubscribePage'

const field: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
}

function AuthorizeCliPage({ requestId }: { requestId: string }) {
  const [state, setState] = useState<'form' | 'done' | 'failed'>('form')
  // A person who has no provisioned tenant yet is sent through subscribe +
  // provisioning first; only an already-active tenant sees the approve form.
  const [gate, setGate] = useState<'loading' | 'authorize' | 'subscribe'>('loading')

  useEffect(() => {
    fetch('/subscribe/status')
      .then((response) => (response.ok ? response.json() : { status: 'active' }))
      .then((status) => setGate(status.status === 'active' ? 'authorize' : 'subscribe'))
      .catch(() => setGate('authorize'))
  }, [])

  if (gate === 'loading') {
    return (
      <PageShell title="Authorize CLI">
        <Card><p style={{ margin: 0, color: 'var(--color-foreground-tint-2)' }}>Loading…</p></Card>
      </PageShell>
    )
  }
  if (gate === 'subscribe') {
    return <SubscribePage requestId={requestId} />
  }

  const approve = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const clientName = new FormData(event.currentTarget).get('clientName')
    const response = await fetch(`/authorize-cli/${encodeURIComponent(requestId)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientName }),
    })
    setState(response.ok ? 'done' : 'failed')
  }

  return (
    <PageShell title="Authorize CLI">
      {state === 'done' ? (
        <Alert variant="success" title="This terminal is authorized">
          A keypair has been issued and is on its way to your CLI. You can
          close this tab and return to your terminal.
        </Alert>
      ) : (
        <Card>
          <p style={{ margin: 0 }}>
            A CLI is asking to be authorized against this platform as you.
            Give it a name you'll recognise — you can revoke it any time from
            the manage keys page.
          </p>
          <Form onSubmit={approve}>
            <label style={field}>
              Client name
              <input
                name="clientName"
                required
                data-warning="Give this CLI a name"
                placeholder="e.g. Chris's laptop"
              />
            </label>
            <button type="submit">Authorize</button>
          </Form>
          {state === 'failed' ? (
            <Alert variant="danger" title="Authorization failed">
              The platform rejected the request — check the terminal is still
              waiting and try again.
            </Alert>
          ) : null}
        </Card>
      )}
    </PageShell>
  )
}

export { AuthorizeCliPage }
