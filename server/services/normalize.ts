import type { AgentAnalyzeResult, AgentFormField } from '../../shared/agent-types'
import { DASHSCOPE_MODEL } from '../config'
import { extractPayload as extractPayloadImpl } from './normalize/json'
import { normalizeAction } from './normalize/actions'
import { coalesceFieldLevelGroups, normalizeGroup, type NormalizedGroup } from './normalize/groups'

export { extractPayloadImpl as extractPayload }

export function normalizeAgentResult(
  payload: Record<string, unknown>,
  formSchema: AgentFormField[]
): AgentAnalyzeResult {
  const backend =
    typeof payload.backend === 'string' ? payload.backend : `dashscope:${DASHSCOPE_MODEL}`

  const diagnostics = Array.isArray(payload.diagnostics)
    ? payload.diagnostics.filter((item): item is string => typeof item === 'string')
    : undefined

  const summary = typeof payload.summary === 'string' ? payload.summary : undefined

  const extractedPairs =
    payload.extractedPairs && typeof payload.extractedPairs === 'object'
      ? Object.entries(payload.extractedPairs).reduce<Record<string, string>>(
          (acc, [key, value]) => {
            if (typeof value === 'string') acc[key] = value
            return acc
          },
          {}
        )
      : {}

  const actions = Array.isArray(payload.actions)
    ? payload.actions
        .map((item) => normalizeAction(item))
        .filter(
          (action): action is NonNullable<ReturnType<typeof normalizeAction>> => action !== null
        )
    : []

  const rawFieldGroups = payload.fieldGroups
  let rawGroups: unknown[] = Array.isArray(rawFieldGroups) ? rawFieldGroups : []

  rawGroups = coalesceFieldLevelGroups(rawGroups, formSchema)

  const normalizedGroups = rawGroups
    .map((item, index) => normalizeGroup(item, index, formSchema.length))
    .filter((item): item is NormalizedGroup => item !== null)

  normalizedGroups.sort((a, b) => b.score - a.score)

  const fieldGroups = normalizedGroups.map((item) => item.group)

  return {
    backend,
    summary,
    diagnostics,
    extractedPairs,
    actions,
    fieldGroups,
  }
}
