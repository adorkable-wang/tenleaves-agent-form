/**
 * 基于 Schema 生成初始表单值（中文注释版）
 */
import type { AgentFormField } from '../agent'

export function createInitialFormValues(schema: AgentFormField[]): Record<string, string> {
  return schema.reduce<Record<string, string>>((acc, field) => {
    acc[field.id] = ''
    return acc
  }, {})
}
