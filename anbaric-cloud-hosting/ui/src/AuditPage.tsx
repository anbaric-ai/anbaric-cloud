import { useEffect, useState, type CSSProperties } from 'react'

import { Alert } from '@anbaric/design-system/components/Alert'
import { Badge } from '@anbaric/design-system/components/Badge'
import { Button } from '@anbaric/design-system/components/Button'
import { EmptyState } from '@anbaric/design-system/components/EmptyState'
import { Field } from '@anbaric/design-system/components/Field'
import { Modal } from '@anbaric/design-system/components/Modal'
import { Skeleton } from '@anbaric/design-system/components/Skeleton'
import { Table } from '@anbaric/design-system/components/Table'

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
        : 'neutral'

const mono: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-xs)',
}

const filters: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-md)',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
}

const filter: CSSProperties = { flex: '1 1 10rem' }

const detailsPre: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-xs)',
  margin: 0,
  padding: 'var(--space-md)',
  maxHeight: '60vh',
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  background: 'var(--color-background-shade-1)',
  borderRadius: 'var(--radius-element)',
  color: 'var(--color-foreground)',
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
  const [selected, setSelected] = useState<AuditRecord | undefined>(undefined)

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
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void load(0)
        }}
        style={filters}
      >
        <Field label="Resource">
          <select value={resourceType} onChange={(event) => setResourceType(event.target.value)} style={filter}>
            <option value="">Any</option>
            {RESOURCE_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Resource id">
          <input placeholder="Any" value={resourceId} onChange={(event) => setResourceId(event.target.value)} style={filter} />
        </Field>
        <Field label="Actor">
          <input placeholder="Any" value={actorId} onChange={(event) => setActorId(event.target.value)} style={filter} />
        </Field>
        <Field label="Interaction">
          <select value={interaction} onChange={(event) => setInteraction(event.target.value)} style={filter}>
            <option value="">Any</option>
            {INTERACTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <input placeholder="Contains…" value={search} onChange={(event) => setSearch(event.target.value)} style={filter} />
        </Field>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {failed ? (
        <Alert variant="danger" title="Could not load the audit trail">
          The platform rejected the request — try reloading the page.
        </Alert>
      ) : null}

      {!records ? (
        <Skeleton lines={6} />
      ) : (
        <Table
          label="Audit trail"
          rows={records}
          rowKey={(record) => record.id}
          empty={<EmptyState icon="history" title="No audit records match">Loosen the filters above to see more.</EmptyState>}
          columns={[
            { id: 'when', header: 'When', muted: true, cell: (record) => <span style={{ whiteSpace: 'nowrap' }}>{formatDate(record.at)}</span> },
            {
              id: 'resource',
              header: 'Resource',
              primary: true,
              cell: (record) => (
                <span style={{ display: 'inline-flex', gap: 'var(--space-xs)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge tone="outline">{record.resourceType}</Badge>
                  <span style={mono}>{record.resourceId}</span>
                </span>
              ),
            },
            {
              id: 'actor',
              header: 'Actor',
              cell: (record) => (
                <Badge tone={actorTone(record.actorType)} dot>
                  {record.actorId}
                </Badge>
              ),
            },
            {
              id: 'interaction',
              header: 'Interaction',
              cell: (record) => (
                <span style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                  {record.interaction.map((each) => (
                    <Badge key={each} tone={interactionTone(each)}>
                      {each}
                    </Badge>
                  ))}
                </span>
              ),
            },
            { id: 'description', header: 'Description', cell: (record) => record.description },
            {
              id: 'details',
              header: '',
              align: 'right',
              cell: (record) =>
                record.details == null ? null : (
                  <Button variant="ghost" onClick={() => setSelected(record)}>
                    View
                  </Button>
                ),
            },
          ]}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
        <Button variant="secondary" disabled={page === 0} onClick={() => void load(page - 1)}>
          ← Newer
        </Button>
        <span style={{ ...mono, color: 'var(--color-foreground-tint-2)' }}>Page {page + 1}</span>
        <Button variant="secondary" disabled={(records?.length ?? 0) < PAGE_SIZE} onClick={() => void load(page + 1)}>
          Older →
        </Button>
      </div>

      <Modal open={selected != null} onClose={() => setSelected(undefined)} title="Audit details">
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge tone="outline">{selected.resourceType}</Badge>
              <span style={mono}>{selected.resourceId}</span>
              {selected.interaction.map((each) => (
                <Badge key={each} tone={interactionTone(each)}>
                  {each}
                </Badge>
              ))}
            </div>
            <p style={{ margin: 0, color: 'var(--color-foreground-tint-2)' }}>{selected.description}</p>
            <pre style={detailsPre}>{JSON.stringify(selected.details, null, 2)}</pre>
          </div>
        ) : null}
      </Modal>
    </>
  )
}

export { AuditPage }
