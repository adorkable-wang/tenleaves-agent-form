import { useState, useCallback } from 'react'
import type { AgentAnalyzeResult } from '../agent'
import type { ProgressStep } from '../components/assistant/types'

export type TaskLog = {
  id: string
  label: string
  status: 'pending' | 'success' | 'error'
  startedAt: number
  durationMs?: number
  error?: string
  steps: ProgressStep[]
  result?: AgentAnalyzeResult
}

export function useAssistantTasks(initialTasks: TaskLog[] = []) {
  const [tasks, setTasks] = useState<TaskLog[]>(initialTasks)

  const appendTask = useCallback((task: TaskLog) => {
    setTasks((prev) => [task, ...prev])
  }, [])

  const updateTask = useCallback((taskId: string, updater: (task: TaskLog) => TaskLog) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? updater(task) : task)))
  }, [])

  const clearTasks = useCallback(() => {
    setTasks([])
  }, [])

  return { tasks, appendTask, updateTask, clearTasks }
}
