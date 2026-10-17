import { useEffect, useState } from 'react'

import { Alert } from '@anbaric/design-system/components/Alert'
import { Card } from '@anbaric/design-system/components/Card'
import { Field } from '@anbaric/design-system/components/Field'
import { Form } from '@anbaric/design-system/components/Form'
import { Skeleton } from '@anbaric/design-system/components/Skeleton'

import { PageShell } from './PageShell'
import { FOLLOW_NOTHING, signedOut, signInAgain } from './session'
import { SubscribePage } from './SubscribePage'

function AuthorizeCliPage({ requestId }: { requestId: string }) {
  const [state, setState] = useState<'form' | 'done' | 'failed'>('form')
  const [refusal, setRefusal] = useState<string | undefined>(undefined)
  // A person who has no provisioned tenant yet is sent through subscribe +
  // provisioning first; only an already-active tenant sees the approve form.
  const [gate, setGate] = useState<'loading' | 'authorize' | 'subscribe'>('loading')

  useEffect(() => {
    fetch('/subscribe/status', FOLLOW_NOTHING)
      .then((response) => {
        if (signedOut(response)) return signInAgain()
        return (response.ok ? response.json() : { status: 'active' })
      })
      .then((status) => status && setGate(status.status === 'active' ? 'authorize' : 'subscribe'))
      .catch(() => setGate('authorize'))
  }, [])

  if (gate === 'loading') {
    return (
      <PageShell title="Authorize CLI">
        <Skeleton lines={3} />
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
    if (response.ok) return setState('done')

    // Say what the platform actually objected to. The common refusal is a role
    // that cannot create keys in the tenant this session is currently in, which
    // "try again" will never fix - switching tenant will.
    const reason = (await response.json().catch(() => ({}))).error
    setRefusal(typeof reason === 'string' ? reason : undefined)
    setState('failed')
  }

  return (
    <PageShell title="Authorize CLI">
      {state === 'done' ? (
        <Alert variant="success" title="This terminal is authorized">
          A keypair has been issued and is on its way to your CLI. You can
          close this tab and return to your terminal.
        </Alert>
      ) : (
        <Card title="Authorize this CLI" subtitle="A CLI is asking to be authorized against this platform as you. Give it a name you'll recognise — you can revoke it any time from the manage keys page.">
          <Form onSubmit={approve}>
            <Field label="Client name" required>
              <input
                name="clientName"
                required
                data-warning="Give this CLI a name"
                placeholder="e.g. Work laptop"
              />
            </Field>
            <button type="submit">Authorize</button>
          </Form>
          {state === 'failed' ? (
            <Alert variant="danger" title="Authorization failed">
              {refusal
                ? `${refusal}. If this is the wrong tenant, switch to the one you meant and run the command again.`
                : 'The platform rejected the request — check the terminal is still waiting and try again.'}
            </Alert>
          ) : null}
        </Card>
      )}
    </PageShell>
  )
}

export { AuthorizeCliPage }
