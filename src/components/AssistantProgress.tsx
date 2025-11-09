/**
 * AssistantProgress（进度指示组件）
 *
 * 功能：
 * - 展示 LLM 分析过程中的分步进度与整体百分比；
 * - 支持显示当前激活步骤、已完成/错误标记，以及累计用时；
 * - 纯展示型组件，不包含业务逻辑，由上层传入 steps 与 elapsedMs。
 */
import React from 'react'

export type ProgressStatus = 'pending' | 'active' | 'done' | 'error'

export interface ProgressStep {
  id: string
  label: string
  status: ProgressStatus
  detail?: string
}

interface Props {
  steps: ProgressStep[]
  elapsedMs?: number
}

/**
 * 计算整体百分比：
 * - done 计 1，active 计 0.6（体现“进行中”），pending/error 计 0；
 * - 最终转换为 0~100 的整数。
 */
function computePercent(steps: ProgressStep[]): number {
  if (!steps.length) return 0
  const score = steps.reduce((acc, s) => acc + (s.status === 'done' ? 1 : s.status === 'active' ? 0.6 : 0), 0)
  return Math.min(100, Math.max(0, Math.round((score / steps.length) * 100)))
}

export const AssistantProgress: React.FC<Props> = ({ steps, elapsedMs = 0 }) => {
  const percent = computePercent(steps)
  const seconds = (elapsedMs / 1000).toFixed(1)

  return (
    <div className="p-3 border-b border-slate-200/70 bg-slate-50/60">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-700">分析进度</div>
        <div className="text-xs text-slate-500">用时 {seconds}s · {percent}%</div>
      </div>
      <div className="w-full h-2 rounded-full bg-slate-200/70 overflow-hidden">
        <div
          className="h-2 bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-2 grid gap-1">
        {steps.map((step) => {
          const icon =
            step.status === 'done' ? (
              <span className="i-material-symbols-check-circle-rounded text-emerald-600" />
            ) : step.status === 'active' ? (
              <span className="i-line-md:loading-twotone-loop text-indigo-600" />
            ) : step.status === 'error' ? (
              <span className="i-material-symbols-error-rounded text-red-600" />
            ) : (
              <span className="i-material-symbols-radio-button-unchecked-rounded text-slate-400" />
            )
          const color =
            step.status === 'done'
              ? 'text-emerald-700'
              : step.status === 'active'
              ? 'text-indigo-700'
              : step.status === 'error'
              ? 'text-red-700'
              : 'text-slate-600'
          return (
            <div key={step.id} className={`flex items-center gap-2 text-xs ${color}`}>
              <span className="w-4 h-4 grid place-items-center">{icon}</span>
              <span>{step.label}</span>
              {step.detail ? <span className="text-slate-400">· {step.detail}</span> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default AssistantProgress

