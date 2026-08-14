import { useEffect, useState, type CSSProperties } from 'react'

import { Alert } from '@anbaric/design-system/components/Alert'
import { Badge } from '@anbaric/design-system/components/Badge'
import { Card } from '@anbaric/design-system/components/Card'

import { PageShell } from './PageShell'
import { PlatformNav } from './PlatformNav'

interface StateMachine {
  workflowId: string
  url: string
}

interface Job {
  id: string
  state: string
  workflowId?: string
  properties: Record<string, unknown>
}

const machineHeading: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-title)',
  fontSize: '1.15rem',
  textTransform: 'var(--title-transform)' as CSSProperties['textTransform'],
}

const cell: CSSProperties = {
  textAlign: 'left',
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

function JobsTable({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) {
    return <p style={{ margin: 0, color: 'var(--color-foreground-tint-2)' }}>No jobs yet.</p>
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={headerCell}>Job</th>
          <th style={headerCell}>State</th>
          <th style={headerCell}>Properties</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.id}>
            <td style={{ ...cell, ...mono }}>{job.id}</td>
            <td style={cell}>
              <Badge tone="primary" dot>
                {job.state}
              </Badge>
            </td>
            <td style={{ ...cell, ...mono, overflowWrap: 'anywhere' }}>
              {JSON.stringify(job.properties)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function LandingPage() {
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
    <PageShell title="Dashboard" width="52rem" nav={<PlatformNav />}>
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
    </PageShell>
  )
}

export { LandingPage }
