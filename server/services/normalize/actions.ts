import { clampConfidence } from './options'

type NormalizedAction = {
  type: string
  target?: string
  payload?: Record<string, unknown>
  confidence: number
  rationale?: string
}

/**
 * 归一化 actions 列表
 * - 过滤无效项，保证 type/confidence 存在
 * - clampConfidence 确保数值范围合法
 */
export function normalizeAction(item: unknown): NormalizedAction | null {
  if (!item || typeof item !== 'object') return null
  const record = item as Record<string, unknown>
  const type = typeof record.type === 'string' ? record.type : null
  if (!type) return null
  const target = typeof record.target === 'string' ? record.target : undefined
  const payload =
    record.payload && typeof record.payload === 'object'
      ? (record.payload as Record<string, unknown>)
      : undefined
  const confidence =
    typeof record.confidence === 'number' ? clampConfidence(record.confidence) : 0.5
  const rationale = typeof record.rationale === 'string' ? record.rationale : undefined
  return { type, target, payload, confidence, rationale }
}
