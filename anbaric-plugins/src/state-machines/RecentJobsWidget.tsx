import { useEffect, useState } from 'react'

import { Alert } from '@anbaric/design-system/components/Alert'
import { Badge } from '@anbaric/design-system/components/Badge'
import { Card } from '@anbaric/design-system/components/Card'

import { cell, formatDate, headerCell, machineHeading, mono, muted, tableScroller } from './presentation'
import { mostRecent } from './recentJobs'
import type { Job } from './types'

function RecentJobsWidget() {
  const [jobs, setJobs] = useState<Array<Job> | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/jobs')
        if (!response.ok) return setFailed(true)
        setJobs(await response.json())
      } catch {
        setFailed(true)
      }
    })()
  }, [])

  if (failed) {
    return (
      <Alert variant="danger" title="Could not load recent jobs">
        The platform rejected the request — try reloading the page.
      </Alert>
    )
  }

  const recent = mostRecent(jobs ?? [])

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-md)',
        }}
      >
        <h2 style={machineHeading}>Recent jobs</h2>
        {jobs ? (
          <Badge tone="neutral">
            {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} in total
          </Badge>
        ) : null}
      </div>

      {recent.length === 0 ? (
        <p style={{ margin: 0, ...muted }}>No jobs yet.</p>
      ) : (
        <div style={tableScroller}>
          <table style={{ width: '100%', minWidth: '36rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={headerCell}>Job</th>
                <th style={headerCell}>State machine</th>
                <th style={headerCell}>State</th>
                <th style={headerCell}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((job) => (
                <tr key={job.id}>
                  <td style={{ ...cell, ...mono }}>{job.id}</td>
                  <td style={{ ...cell, ...mono }}>{job.workflowId ?? <span style={muted}>—</span>}</td>
                  <td style={cell}>
                    <Badge tone="primary" dot>
                      {job.state}
                    </Badge>
                  </td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{formatDate(job.lastUpdated ?? job.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export { RecentJobsWidget }
