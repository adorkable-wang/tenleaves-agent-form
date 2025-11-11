import { describe, expect, it } from 'vitest'
import { safeToString } from '../../server/services/normalize/safeString'

describe('safeToString', () => {
  it('直接返回字符串输入', () => {
    expect(safeToString('hello')).toBe('hello')
  })

  it('支持数字与布尔值', () => {
    expect(safeToString(42)).toBe('42')
    expect(safeToString(true)).toBe('true')
  })

  it('对象会 JSON.stringify，并在失败时返回 undefined', () => {
    expect(safeToString({ foo: 'bar' })).toContain('"foo":"bar"')
    const recursive: Record<string, unknown> = {}
    recursive.self = recursive
    expect(safeToString(recursive)).toBeUndefined()
  })
})
