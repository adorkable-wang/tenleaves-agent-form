/**
 * 智能体结果的通用工具（中文注释版）
 */
import type { AgentAnalyzeResult } from './types'

/**
 * 选择一组“初始化回填”的表单值：
 * - 若存在 fieldGroups，则优先选取置信度最高的一组，将组内字段写入
 * - 对于每个字段，再用字段主值或候选首值补齐
 */
export function chooseInitialValuesFromResult(result: AgentAnalyzeResult): Record<string, string> {
  const values: Record<string, string> = {}
  const primaryGroup = result.fieldGroups?.length
    ? [...result.fieldGroups].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]
    : null
  if (primaryGroup) {
    for (const [fieldId, option] of Object.entries(primaryGroup.fields)) {
      if (option.value) values[fieldId] = option.value
    }
  }
  for (const field of result.fields) {
    const v = field.value ?? field.options?.[0]?.value
    if (v && !values[field.fieldId]) values[field.fieldId] = v
  }
  return values
}

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
