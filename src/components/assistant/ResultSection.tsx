import type { AgentFieldGroup } from '../../agent'
import type { GroupPreview } from '../../hooks/useGroupPreviews'
import GroupCard from './GroupCard'

interface ResultSectionProps {
  previews: GroupPreview[]
  manualGroupId: string | null
  sourceLabel?: string
  canRetry: boolean
  pending: boolean
  onRetry: () => void
  onApply: (group: AgentFieldGroup) => void
}

export function ResultSection({
  previews,
  manualGroupId,
  sourceLabel,
  canRetry,
  pending,
  onRetry,
  onApply,
}: ResultSectionProps) {
  if (!previews.length) return null
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">最新识别结果</p>
          <p className="text-xs text-slate-400">来源：{sourceLabel ?? '本次任务'}</p>
        </div>
        {canRetry ? (
          <button
            type="button"
            className="text-xs text-indigo-600 underline-offset-2 hover:underline disabled:opacity-50"
            onClick={onRetry}
            disabled={pending}
          >
            使用相同输入重试
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {previews.map((preview) => {
          const isApplied = manualGroupId === preview.group.id
          return (
            <GroupCard
              key={preview.group.id}
              preview={preview}
              isApplied={isApplied}
              onApply={onApply}
            />
          )
        })}
      </div>
    </section>
  )
}

export default ResultSection
