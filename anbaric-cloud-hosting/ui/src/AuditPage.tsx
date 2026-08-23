import { useEffect, useState, type CSSProperties } from 'react'

import { Alert } from '@anbaric/design-system/components/Alert'
import { Badge } from '@anbaric/design-system/components/Badge'
import { Card } from '@anbaric/design-system/components/Card'

const PAGE_SIZE = 50

interface AuditRecord {
  id: string
  resourceType: string
  resourceId: string
  actorId: string
  actorType: string
  interaction: string[]
  description: string
  details: unknown
  at: string
}

const INTERACTIONS = ['INITIALIZE', 'CREATE', 'UPDATE_PROPERTIES', 'CHANGE_STATE', 'DELETE', 'KILL', 'READ', 'LIST']
const RESOURCE_TYPES = ['state-machine', 'job', 'document', 'secret']

const interactionTone = (interaction: string) =>
  interaction === 'CREATE' || interaction === 'INITIALIZE'
    ? 'success'
    : interaction === 'DELETE' || interaction === 'KILL'
      ? 'danger'
      : interaction === 'CHANGE_STATE'
        ? 'primary'
        : interaction === 'READ' || interaction === 'LIST'
          ? 'neutral'
          : 'neutral'

const cell: CSSProperties = {
  textAlign: 'left',
  verticalAlign: 'top',
  padding: 'calc(var(--space-sm) / 2) var(--space-sm)',
  borderBottom: '1px solid color-mix(in srgb, var(--color-grey) 12%, transparent)',
}

const headerCell: CSSProperties = {
  ...cell,
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-foreground-tint-2)',
}

const mono: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.78rem',
}

const filterInput: CSSProperties = {
  font: 'inherit',
  padding: 'var(--space-sm)',
  border: '1px solid var(--color-background-shade-2)',
  borderRadius: 'var(--radius-element)',
  background: 'var(--color-background)',
  color: 'var(--color-foreground)',
  minWidth: '10rem',
}

const pageButton: CSSProperties = {
  font: 'inherit',
  padding: 'var(--space-sm) var(--space-md)',
  border: '1px solid var(--color-background-shade-2)',
  borderRadius: 'var(--radius-element)',
  background: 'var(--color-background)',
  color: 'var(--color-foreground)',
  cursor: 'pointer',
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })

const actorTone = (type?: string) =>
  type === 'HUMAN' ? 'primary' : type === 'AGENT' ? 'warning' : 'neutral'

function AuditPage() {
  const [records, setRecords] = useState<AuditRecord[] | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [resourceType, setResourceType] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [actorId, setActorId] = useState('')
  const [interaction, setInteraction] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const load = async (pageToLoad: number) => {
    const query = new URLSearchParams()
    if (resourceType) query.set('resourceType', resourceType)
    if (resourceId.trim()) query.set('resourceId', resourceId.trim())
    if (actorId.trim()) query.set('actorId', actorId.trim())
    if (interaction) query.set('interaction', interaction)
    if (search.trim()) query.set('search', search.trim())
    query.set('pageSize', String(PAGE_SIZE))
    query.set('page', String(pageToLoad))
    try {
      const response = await fetch(`/api/v2/audits?${query}`)
      if (!response.ok) {
        setFailed(true)
        return
      }
      setFailed(false)
      setRecords(await response.json())
      setPage(pageToLoad)
    } catch {
      setFailed(true)
    }
  }

  useEffect(() => {
    void load(0)
  }, [])

  return (
    <>
      <Card>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void load(0)
          }}
          style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <select
            style={filterInput}
            value={resourceType}
            onChange={(event) => setResourceType(event.target.value)}
          >
            <option value="">Any resource</option>
            {RESOURCE_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <input
            style={filterInput}
            placeholder="Resource id"
            value={resourceId}
            onChange={(event) => setResourceId(event.target.value)}
          />
          <input
            style={filterInput}
            placeholder="Actor"
            value={actorId}
            onChange={(event) => setActorId(event.target.value)}
          />
          <select
            style={filterInput}
            value={interaction}
            onChange={(event) => setInteraction(event.target.value)}
          >
            <option value="">Any interaction</option>
            {INTERACTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <input
            style={filterInput}
            placeholder="Description contains…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            type="submit"
            style={{
              font: 'inherit',
              fontWeight: 600,
              padding: 'var(--space-sm) var(--space-md)',
              border: 'none',
              borderRadius: 'var(--radius-element)',
              background: 'var(--gradient-ink)',
              color: 'var(--color-background)',
              cursor: 'pointer',
            }}
          >
            Filter
          </button>
        </form>
      </Card>
      {failed ? (
        <Alert variant="danger" title="Could not load the audit trail">
          The platform rejected the request — try reloading the page.
        </Alert>
      ) : null}
      <Card>
        {records && records.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-foreground-tint-2)' }}>
            No audit records match.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={headerCell}>When</th>
                <th style={headerCell}>Resource</th>
                <th style={headerCell}>Actor</th>
                <th style={headerCell}>Interaction</th>
                <th style={headerCell}>Description</th>
                <th style={headerCell}>Details</th>
              </tr>
            </thead>
            <tbody>
              {(records ?? []).map((record) => (
                <tr key={record.id}>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{formatDate(record.at)}</td>
                  <td style={{ ...cell, ...mono }}>
                    <Badge tone="neutral">{record.resourceType}</Badge>{' '}
                    {record.resourceId}
                  </td>
                  <td style={cell}>
                    <Badge tone={actorTone(record.actorType)} dot>
                      {record.actorId}
                    </Badge>
                  </td>
                  <td style={cell}>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                      {record.interaction.map((interaction) => (
                        <Badge key={interaction} tone={interactionTone(interaction)}>
                          {interaction}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td style={cell}>{record.description}</td>
                  <td style={{ ...cell, ...mono, overflowWrap: 'anywhere' }}>
                    {record.details === null ? '' : JSON.stringify(record.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-md)',
        }}
      >
        <button type="button" style={pageButton} disabled={page === 0} onClick={() => void load(page - 1)}>
          ← Newer
        </button>
        <span style={{ ...mono, color: 'var(--color-foreground-tint-2)' }}>Page {page + 1}</span>
        <button
          type="button"
          style={pageButton}
          disabled={(records?.length ?? 0) < PAGE_SIZE}
          onClick={() => void load(page + 1)}
        >
          Older →
        </button>
      </div>
    </>
  )
}

export { AuditPage }
