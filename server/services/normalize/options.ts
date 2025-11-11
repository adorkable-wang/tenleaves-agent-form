import type { AgentFieldOption } from '../../../shared/agent-types'
import { safeToString } from './safeString'

export const MIN_CONFIDENCE = 0.75
const OPTION_CONF_CAP = 0.85
const OPTION_CONF_BASE = 0.65

export function clampConfidence(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function normalizeOptions(
  raw: unknown,
  meta?: { groupId?: string; groupLabel?: string }
): AgentFieldOption[] {
  const toOption = (input: unknown): AgentFieldOption | null => {
    if (typeof input === 'string') {
      return {
        value: input,
        confidence: Math.min(OPTION_CONF_CAP, OPTION_CONF_BASE + input.length * 0.01),
        groupId: meta?.groupId,
        groupLabel: meta?.groupLabel,
      }
    }
    if (!input || typeof input !== 'object') return null
    const record = input as Record<string, unknown>
    const value = typeof record.value === 'string' ? record.value : safeToString(record.value)
    if (!value) return null
    return {
      value,
      confidence:
        typeof record.confidence === 'number' ? clampConfidence(record.confidence) : undefined,
      rationale:
        typeof record.rationale === 'string' ? record.rationale : safeToString(record.rationale),
      sourceText: typeof record.sourceText === 'string' ? record.sourceText : undefined,
      groupId: meta?.groupId,
      groupLabel: meta?.groupLabel,
    }
  }

  if (Array.isArray(raw)) {
    return sanitizeOptions(
      raw.map((item) => toOption(item)).filter((item): item is AgentFieldOption => item !== null)
    )
  }

  const option = toOption(raw)
  return option ? sanitizeOptions([option]) : []
}

function sanitizeOptions(options: AgentFieldOption[]): AgentFieldOption[] {
  return options
    .map((option) => ({
      ...option,
      confidence:
        typeof option.confidence === 'number' ? clampConfidence(option.confidence) : undefined,
    }))
    .filter((option) => (option.confidence ?? 0) >= MIN_CONFIDENCE)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
}
