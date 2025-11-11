import { describe, expect, it } from 'vitest'
import { normalizeOptions, MIN_CONFIDENCE } from '../../server/services/normalize/options'

describe('normalizeOptions', () => {
  it('将字符串候选转换为带置信度的结构', () => {
    const result = normalizeOptions('Alice Zhang', { groupId: 'g1', groupLabel: 'person' })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      value: 'Alice Zhang',
      groupId: 'g1',
      groupLabel: 'person',
    })
    expect(result[0].confidence).toBeGreaterThan(MIN_CONFIDENCE)
  })

  it('支持对象输入并在必要时 clamp 置信度', () => {
    const result = normalizeOptions({ value: { name: 'Bob' }, confidence: 1.5 }, { groupId: 'g2' })
    expect(result).toHaveLength(1)
    expect(result[0].value).toContain('"name":"Bob"')
    expect(result[0].confidence).toBeLessThanOrEqual(1)
  })

  it('会过滤置信度过低的候选项', () => {
    const result = normalizeOptions([{ value: 'weak', confidence: 0.1 }])
    expect(result).toHaveLength(0)
  })
})
