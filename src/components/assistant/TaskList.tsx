import type { TaskLog } from '../../hooks/useAssistantTasks'

interface TaskListProps {
  tasks: TaskLog[]
  activeTaskId?: string | null
  activeElapsedMs?: number
  onSelectTask?: (task: TaskLog) => void
  onClear?: () => void
}

export function TaskList({
  tasks,
  activeTaskId,
  activeElapsedMs = 0,
  onSelectTask,
  onClear,
}: TaskListProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-inner">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">任务列表</p>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>共 {tasks.length} 个</span>
          {tasks.length ? (
            <button
              type="button"
              className="text-indigo-600 underline-offset-2 hover:underline"
              onClick={onClear}
            >
              清空
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 max-h-48 space-y-2 overflow-auto pr-1">
        {tasks.length === 0 ? (
          <p className="text-xs text-slate-400">暂无任务</p>
        ) : (
          tasks.map((task) => {
            const statusLabel =
              task.status === 'pending' ? '进行中' : task.status === 'success' ? '完成' : '失败'
            const statusColor =
              task.status === 'pending'
                ? 'bg-amber-100 text-amber-700 border-amber-200'
                : task.status === 'success'
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-rose-100 text-rose-700 border-rose-200'
            const isActive = activeTaskId === task.id
            const durationMs =
              task.status === 'pending' && isActive ? activeElapsedMs : (task.durationMs ?? 0)
            const durationLabel =
              durationMs > 0
                ? `${(durationMs / 1000).toFixed(1)}s`
                : task.status === 'pending'
                  ? '进行中...'
                  : '—'
            const progressPercent =
              task.status === 'pending'
                ? 60
                : task.status === 'success'
                  ? 100
                  : task.status === 'error'
                    ? 0
                    : 0
            return (
              <article
                key={task.id}
                className={`space-y-2 rounded-xl border border-slate-200 bg-white/90 px-3 pt-2 pb-3 shadow-sm ${
                  activeTaskId === task.id ? 'ring-1 ring-indigo-400 shadow-indigo-200' : ''
                }`}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => {
                    if (task.result && onSelectTask) onSelectTask(task)
                  }}
                  disabled={!task.result}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{task.label}</p>
                  </div>
                  <div className="text-right">
                    <span className="mr-2 text-[11px] text-slate-500">{durationLabel}</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-medium ${statusColor}`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                </button>
                <div className="-mx-3 -mb-3 px-3">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full transition-all duration-300 ${
                        task.status === 'error'
                          ? 'bg-gradient-to-r from-rose-400 to-rose-500'
                          : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}

export default TaskList
