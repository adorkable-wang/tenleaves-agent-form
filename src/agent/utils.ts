/**
 * 智能体结果的通用工具（中文注释版）
 */
import type { AgentFieldGroup } from './types'

/**
 * 统一派发“智能体自动填充”事件，供外部监听联动
 */
export function emitAutofillEvent(values: Record<string, string>, backend: string): void {
  try {
    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new CustomEvent('agent:autofill', { detail: { values, backend } })
      )
    }
  } catch {
    // 忽略事件派发失败
  }
}

/**
 * 根据指定分组提取表单值：
 * - 仅取每个字段候选列表的首项（即最高置信度）
 * - 若字段缺少候选则跳过
 */
export function buildValuesFromGroup(group: AgentFieldGroup): Record<string, string> {
  const values: Record<string, string> = {}
  const fieldCandidates = group.fieldCandidates ?? {}
  for (const [fieldId, candidates] of Object.entries(fieldCandidates)) {
    const best = candidates?.[0]
    if (best?.value) values[fieldId] = best.value
  }
  return values
}
