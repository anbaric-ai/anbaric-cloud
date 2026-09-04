interface StateMachine {
  workflowId: string
  url: string
}

interface Job {
  id: string
  state: string
  workflowId?: string
  properties: Record<string, unknown>
  startedAt?: string
  startedBy?: string
  lastUpdated?: string
  transitions?: Array<{ from: string; to: string; actor: string }>
}

export type { Job, StateMachine }
