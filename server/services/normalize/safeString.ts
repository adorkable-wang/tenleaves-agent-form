/**
 * safeToString
 * - 避免直接对对象调用 String() 触发 lint
 * - 对象统一 JSON.stringify，失败则返回 undefined
 */
export function safeToString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value == null) return undefined
  try {
    return JSON.stringify(value)
  } catch {
    return undefined
  }
}
