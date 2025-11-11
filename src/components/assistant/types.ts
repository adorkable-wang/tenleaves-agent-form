export type ProgressStatus = 'pending' | 'active' | 'done' | 'error'

export interface ProgressStep {
  id: string
  label: string
  status: ProgressStatus
  detail?: string
}
