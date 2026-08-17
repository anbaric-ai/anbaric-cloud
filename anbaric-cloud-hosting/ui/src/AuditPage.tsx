import { useEffect, useState, type CSSProperties } from 'react'

import { Alert } from '@anbaric/design-system/components/Alert'
import { Badge } from '@anbaric/design-system/components/Badge'
import { Card } from '@anbaric/design-system/components/Card'

import { PageShell } from './PageShell'
import { PlatformNav } from './PlatformNav'

interface AuditRecord {
  id: string
  jobId: string
  actorId: string
  actorType: string
  change: string
  description: string
  details: unknown
  at: string
}

const CHANGES = ['CREATE', 'UPDATE_PROPERTIES', 'CHANGE_STATE', 'DELETE']

const changeTone = (change: string) =>
  change === 'CREATE' ? 'success' : change === 'DELETE' ? 'danger' : change === 'CHANGE_STATE' ? 'primary' : 'neutral'

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
  minWidth: '12rem',
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
  const [jobId, setJobId] = useState('')
  const [actorId, setActorId] = useState('')
  const [change, setChange] = useState('')
  const [search, setSearch] = useState('')

  const load = async () => {
    const query = new URLSearchParams()
    if (jobId.trim()) query.set('jobId', jobId.trim())
    if (actorId.trim()) query.set('actorId', actorId.trim())
    if (change) query.set('change', change)
    if (search.trim()) query.set('search', search.trim())
    try {
      const response = await fetch(`/audits?${query}`)
      if (!response.ok) {
        setFailed(true)
        return
      }
      setFailed(false)
      setRecords(await response.json())
    } catch {
      setFailed(true)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <PageShell title="Audit" width="64rem" nav={<PlatformNav />}>
      <Card>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void load()
          }}
          style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <input
            style={filterInput}
            placeholder="Job id"
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
          />
          <input
            style={filterInput}
            placeholder="Actor"
            value={actorId}
            onChange={(event) => setActorId(event.target.value)}
          />
          <select
            style={filterInput}
            value={change}
            onChange={(event) => setChange(event.target.value)}
          >
            <option value="">Any change</option>
            {CHANGES.map((value) => (
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
                <th style={headerCell}>Job</th>
                <th style={headerCell}>Actor</th>
                <th style={headerCell}>Change</th>
                <th style={headerCell}>Description</th>
                <th style={headerCell}>Details</th>
              </tr>
            </thead>
            <tbody>
              {(records ?? []).map((record) => (
                <tr key={record.id}>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{formatDate(record.at)}</td>
                  <td style={{ ...cell, ...mono }}>{record.jobId.slice(0, 8)}</td>
                  <td style={cell}>
                    <Badge tone={actorTone(record.actorType)} dot>
                      {record.actorId}
                    </Badge>
                  </td>
                  <td style={cell}>
                    <Badge tone={changeTone(record.change)}>{record.change}</Badge>
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
    </PageShell>
  )
}

export { AuditPage }
