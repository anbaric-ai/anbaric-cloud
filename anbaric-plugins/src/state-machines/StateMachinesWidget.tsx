import { useEffect, useState } from 'react'

import { Alert } from '@anbaric/design-system/components/Alert'
import { Badge } from '@anbaric/design-system/components/Badge'
import { Card } from '@anbaric/design-system/components/Card'

import { cell, formatDate, headerCell, machineHeading, mono, muted, tableScroller } from './presentation'
import type { Job, StateMachine } from './types'

function PropertyList({ job }: { job: Job }) {
  const entries: Array<[string, unknown]> = [['id', job.id], ...Object.entries(job.properties)]
  return (
    <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {entries.map(([name, value]) => (
        <div key={name} style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'baseline' }}>
          <dt style={{ ...mono, ...muted, flex: 'none' }}>{name}</dt>
          <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{String(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function TransitionHistory({ transitions }: { transitions: Job['transitions'] }) {
  if (!transitions || transitions.length === 0) {
    return <span style={muted}>—</span>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {transitions.map((transition, index) => (
        <div key={index}>
          {transition.from} → {transition.to}{' '}
          <span style={{ ...muted, fontSize: '0.78rem' }}>by {transition.actor}</span>
        </div>
      ))}
    </div>
  )
}

function JobsTable({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) {
    return <p style={{ margin: 0, color: 'var(--color-foreground-tint-2)' }}>No jobs yet.</p>
  }
  return (
    <div style={tableScroller}>
      <table style={{ width: '100%', minWidth: '44rem', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={headerCell}>Properties</th>
          <th style={headerCell}>State</th>
          <th style={headerCell}>Started</th>
          <th style={headerCell}>Updated</th>
          <th style={headerCell}>History</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.id}>
            <td style={cell}>
              <PropertyList job={job} />
            </td>
            <td style={cell}>
              <Badge tone="primary" dot>
                {job.state}
              </Badge>
            </td>
            <td style={cell}>
              {formatDate(job.startedAt)}
              <div style={{ ...muted, fontSize: '0.78rem' }}>by {job.startedBy ?? 'system'}</div>
            </td>
            <td style={cell}>{formatDate(job.lastUpdated)}</td>
            <td style={cell}>
              <TransitionHistory transitions={job.transitions} />
            </td>
          </tr>
        ))}
      </tbody>
      </table>
    </div>
  )
}

function StateMachinesWidget() {
  const [machines, setMachines] = useState<StateMachine[] | undefined>(undefined)
  const [jobs, setJobs] = useState<Job[] | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const [machinesResponse, jobsResponse] = await Promise.all([
          fetch('/state-machines'),
          fetch('/jobs'),
        ])
        if (!machinesResponse.ok || !jobsResponse.ok) {
          setFailed(true)
          return
        }
        setMachines(await machinesResponse.json())
        setJobs(await jobsResponse.json())
      } catch {
        setFailed(true)
      }
    })()
  }, [])

  const registered = new Set((machines ?? []).map((machine) => machine.workflowId))
  const workflowIds = [
    ...new Set([
      ...registered,
      ...(jobs ?? [])
        .map((job) => job.workflowId)
        .filter((workflowId): workflowId is string => Boolean(workflowId)),
    ]),
  ].sort()
  const unassigned = (jobs ?? []).filter((job) => !job.workflowId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {failed ? (
        <Alert variant="danger" title="Could not load the platform state">
          The platform rejected the request — try reloading the page.
        </Alert>
      ) : null}
      {machines && workflowIds.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>
            No state machines yet. Deploy an app with <code>anbaric deploy</code> and its
            machines will appear here.
          </p>
        </Card>
      ) : null}
      {workflowIds.map((workflowId) => {
        const machineJobs = (jobs ?? []).filter((job) => job.workflowId === workflowId)
        return (
          <Card key={workflowId}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                marginBottom: 'var(--space-md)',
              }}
            >
              <h2 style={machineHeading}>{workflowId}</h2>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <Badge tone="neutral">
                  {machineJobs.length} {machineJobs.length === 1 ? 'job' : 'jobs'}
                </Badge>
                {registered.has(workflowId) ? (
                  <Badge tone="success" dot>
                    consumer connected
                  </Badge>
                ) : (
                  <Badge tone="warning" dot>
                    no consumer
                  </Badge>
                )}
              </div>
            </div>
            <JobsTable jobs={machineJobs} />
          </Card>
        )
      })}
      {unassigned.length > 0 ? (
        <Card>
          <h2 style={{ ...machineHeading, marginBottom: 'var(--space-md)' }}>
            Unassigned jobs
          </h2>
          <JobsTable jobs={unassigned} />
        </Card>
      ) : null}
    </div>
  )
}

export { StateMachinesWidget }
