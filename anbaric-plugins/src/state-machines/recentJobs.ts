import type { Job } from './types'

const RECENT_LIMIT = 10

const updatedAt = (job: Job) => new Date(job.lastUpdated ?? job.startedAt ?? 0).getTime()

// Most recently touched first, falling back to when the job started for one
// that has never been updated.
const mostRecent = (jobs: Array<Job>, limit: number = RECENT_LIMIT) =>
  [...jobs].sort((left, right) => updatedAt(right) - updatedAt(left)).slice(0, limit)

export { RECENT_LIMIT, mostRecent }
