/**
 * 应用侧 Schema 与 DOM 快照对齐器（中文注释版）
 *
 * 作用：把“应用侧定义（稳定）”与“浏览器 DOM 快照（实时）”合并，
 * 产出：
 *  - 最终给 LLM 的 AgentFormField[]（以应用侧为主，DOM 补充同义词/选项）
 *  - mapping：appId -> domSelector（用于回填）
 *  - diffs：差异清单，便于在 UI 中提示/人工确认
 */
import type { AgentFormField } from '../agent'
import type { DomFormField } from './dom'

export type AppValidation = {
  pattern?: string
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
}

export type AppFormField = AgentFormField & {
  type?: 'text' | 'textarea' | 'email' | 'tel' | 'number' | 'select' | 'radio' | 'checkbox' | 'date'
  defaultValue?: string
  options?: Array<{ value: string; label?: string }>
  validation?: AppValidation
  groupId?: string
  ui?: { placeholder?: string; order?: number; width?: number }
}

export type AppFormGroup = { id: string; label?: string; requiredFields?: string[] }

export type AppFormSchema = {
  version: string
  name?: string
  fields: AppFormField[]
  groups?: AppFormGroup[]
  metadata?: Record<string, unknown>
}

// 对齐策略配置
export type ReconcileOptions = {
  precedence?: 'app' | 'dom' | 'merge'
  fieldOverrides?: Record<string, 'app' | 'dom'>
}

export type ReconcileResult = {
  schema: AgentFormField[]
  mapping: Record<string, string> // 字段映射：应用字段 ID（或 DOM-only 的 stableId）-> 选择器
  diffs: Array<{ fieldId: string; kind: string; app?: unknown; dom?: unknown; note?: string }>
}

/**
 * 对齐入口：
 * - appSchema 可无（DOM-only 场景）
 * - precedence：默认 merge（推荐）
 */
export function reconcileSchemas(
  app: AppFormSchema | null | undefined,
  dom: { fields: DomFormField[] } | null | undefined,
  options: ReconcileOptions = {}
): ReconcileResult {
  const precedence = options.precedence ?? 'merge'
  const domFields = dom?.fields ?? []
  const resultSchema: AgentFormField[] = []
  const mapping: Record<string, string> = {}
  const diffs: ReconcileResult['diffs'] = []

  const takeFromDomIf = (fieldId: string) => {
    const override = options.fieldOverrides?.[fieldId]
    if (override) return override === 'dom'
    return precedence === 'dom'
  }

  // 基于 id/name/label/同义词 的“最好匹配”规则
  const findBestDom = (appField: AppFormField): DomFormField | null => {
    if (!domFields.length) return null
    // 1) 按 name/id 精确匹配
    const byName = domFields.find(
      (d) => d.name && d.name.toLowerCase() === appField.id.toLowerCase()
    )
    if (byName) return byName
    const byId = domFields.find(
      (d) => d.idAttr && d.idAttr.toLowerCase() === appField.id.toLowerCase()
    )
    if (byId) return byId
    // 2) 标签相似（忽略大小写，包含关系）
    const al = (appField.label || '').toLowerCase()
    if (al) {
      const byLabel = domFields.find((d) => (d.label || '').toLowerCase() === al)
      if (byLabel) return byLabel
      const contains = domFields.find((d) => (d.label || '').toLowerCase().includes(al))
      if (contains) return contains
    }
    // 3) 同义词包含
    for (const s of appField.synonyms ?? []) {
      const sl = s.toLowerCase()
      const m = domFields.find((d) => (d.label || '').toLowerCase().includes(sl))
      if (m) return m
    }
    return null
  }

  // 合并路径：有应用侧字段则以其为主；否则退化为 DOM-only
  if (app?.fields?.length) {
    for (const af of app.fields) {
      const df = findBestDom(af)
      const fieldId = af.id
      const prefersDom = takeFromDomIf(fieldId)
      const merged: AgentFormField = {
        id: af.id,
        label: prefersDom ? df?.label || af.label : af.label,
        description: af.description,
        required: af.required,
        synonyms: mergeUniqStrings(af.synonyms, tokens(df?.label), tokens(df?.placeholder)),
        example: af.example,
      }

      // 当 DOM 有实时可选项（下拉/单选）时，作为同义词并入，提升召回
      const domOptions = df?.options?.map((o) => o.value).filter(Boolean) ?? []
      if (domOptions.length && (af.type === 'select' || af.type === 'radio')) {
        // 不直接作为 options 写入 AgentFormField，作为 synonyms 辅助 LLM 匹配
        merged.synonyms = mergeUniqStrings(merged.synonyms, domOptions)
      }

      resultSchema.push(merged)
      if (df?.domSelector) mapping[fieldId] = df.domSelector

      // 记录差异（便于 UI 提示）
      if (df) {
        if (af.label && df.label && af.label !== df.label) {
          diffs.push({ fieldId, kind: 'label_mismatch', app: af.label, dom: df.label })
        }
      } else {
        diffs.push({ fieldId, kind: 'dom_missing', app: af, note: '未在 DOM 中找到匹配字段' })
      }
    }

    // 额外 DOM 字段（当策略偏向 DOM 时纳入扩展）
    const appIds = new Set(app.fields.map((f) => f.id.toLowerCase())) // 用于过滤“已存在的 app 字段”
    for (const d of domFields) {
      // 尝试用 name/idAttr 判断是否与 app id 对应
      const key = (d.name || d.idAttr || '').toLowerCase()
      if (key && appIds.has(key)) continue
      if (precedence === 'dom') {
        const id = d.stableId
        resultSchema.push({
          id,
          label: d.label || id,
          synonyms: tokens(d.label, d.placeholder),
        })
        if (d.domSelector) mapping[id] = d.domSelector
        diffs.push({ fieldId: id, kind: 'app_missing', dom: d, note: 'DOM 发现额外字段' })
      }
    }
  } else {
    // 无应用侧 Schema：直接采用 DOM-only
    for (const d of domFields) {
      const id = d.stableId
      resultSchema.push({ id, label: d.label || id, synonyms: tokens(d.label, d.placeholder) })
      if (d.domSelector) mapping[id] = d.domSelector
    }
  }

  return { schema: resultSchema, mapping, diffs }
}

// 将若干字符串拆分为“去重的词 token 数组”（用于构建 synonyms）
function tokens(...vals: Array<string | undefined>): string[] {
  const set = new Set<string>()
  for (const v of vals) {
    if (!v) continue
    const raw = v
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((s) => s.trim())
      .filter(Boolean)
    raw.forEach((t) => set.add(t))
  }
  return Array.from(set)
}

// 合并字符串数组并去重（忽略空白）
function mergeUniqStrings(
  a?: string[] | null,
  ...rest: Array<string[] | null | undefined>
): string[] | undefined {
  const set = new Set<string>()
  for (const arr of [a, ...rest]) {
    if (!arr) continue
    for (const v of arr) {
      if (v && v.trim()) set.add(v)
    }
  }
  if (!set.size) return undefined
  return Array.from(set)
}
