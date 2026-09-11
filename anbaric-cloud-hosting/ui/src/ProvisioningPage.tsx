import { type CSSProperties } from 'react'

import { Card } from '@anbaric/design-system/components/Card'
import { Steps } from '@anbaric/design-system/components/Steps'

const STEPS = ['Choose plan', 'Payment', 'Provisioning', 'Ready']

const note: CSSProperties = {
  marginTop: 'var(--space-lg)',
  marginBottom: 0,
}

function ProvisioningPage({ current, message, failed = false }: { current: number; message: string; failed?: boolean }) {
  return (
    <Card>
      <Steps steps={STEPS} current={current} />
      <p style={{ ...note, color: failed ? 'var(--color-danger)' : 'var(--color-foreground-tint-2)' }}>
        {message}
      </p>
    </Card>
  )
}

export { ProvisioningPage, STEPS }
