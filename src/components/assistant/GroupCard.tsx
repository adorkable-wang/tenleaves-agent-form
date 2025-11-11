import type { AgentFieldGroup } from '../../agent'
import type { GroupPreview } from '../../hooks/useGroupPreviews'

interface GroupCardProps {
  preview: GroupPreview
  isApplied: boolean
  onApply: (group: AgentFieldGroup) => void
}

function CandidateList({
  entries,
  duplicateValues,
}: {
  entries: GroupPreview['entries']
  duplicateValues: Set<string>
}) {
  return (
    <div className="relative mt-2 flex-1 min-h-0 overflow-hidden">
      {entries.length ? (
        <div className="pr-1 h-full overflow-y-auto">
          <ul className="space-y-1 text-xs text-slate-600">
            {entries.map((entry) => {
              const normalized = entry.value.trim().toLowerCase()
              const isDuplicate = duplicateValues.has(normalized)
              return (
                <li key={`${entry.fieldId}`} className="flex flex-col">
                  <span className="text-[11px] text-slate-400">{entry.label}</span>
                  <span
                    className={`font-medium ${isDuplicate ? 'text-amber-600' : 'text-slate-800'}`}
                  >
                    {entry.value}
                    {entry.confidence != null ? (
                      <span className="ml-1 text-[10px] text-slate-400">
                        {Math.round((entry.confidence ?? 0) * 100)}%
                      </span>
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-400">暂无可展示字段</p>
      )}
    </div>
  )
}

export function GroupCard({ preview, isApplied, onApply }: GroupCardProps) {
  const { group, entries, duplicateValues } = preview
  const confidence = group.confidence != null ? `${Math.round(group.confidence * 100)}%` : '—'

  return (
    <article className="flex min-h-[18rem] flex-col rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex max-w-full truncate rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
          {group.label ?? group.id}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">置信度 {confidence}</span>
          <button
            type="button"
            className={`assistant-check ${isApplied ? 'assistant-check--active' : ''}`}
            onClick={() => {
              onApply(group)
            }}
            disabled={isApplied}
            aria-label="使用此分组回填"
          >
            {isApplied ? (
              <span className="i-material-symbols-check-rounded text-base" />
            ) : (
              <span className="inline-block h-2 w-2 rounded-full bg-indigo-300" />
            )}
          </button>
        </div>
      </div>
      <CandidateList entries={entries} duplicateValues={duplicateValues} />
    </article>
  )
}

export default GroupCard
