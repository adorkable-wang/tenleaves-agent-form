/**
 * Agent Server（服务端）中文注释版
 *
 * 作用：
 *  - 暴露 POST /api/agent/analyze 接口
 *  - 接收 { document, options }，构造提示词与 JSON Schema，调用 DashScope（或其他大模型）
 *  - 解析并“归一化”模型返回，产出前端可用的 AgentAnalyzeResult 结构
 */
import 'dotenv/config'
import express from 'express'
import type { Request, Response } from 'express'
import cors from 'cors'
import type {
  AgentAction,
  AgentAnalyzeOptions,
  AgentAnalyzeResult,
  AgentDocument,
  AgentFieldGroup,
  AgentFieldInference,
  AgentFieldOption,
  AgentFormField,
} from '../src/agent'

// 读取环境变量与默认配置
const PORT = Number(process.env.PORT ?? 8787)
const DASHSCOPE_ENDPOINT =
  process.env.DASHSCOPE_ENDPOINT ??
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL ?? 'qwen-plus'
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY

// 必要的密钥检查
if (!DASHSCOPE_API_KEY) {
  throw new Error('缺少 DASHSCOPE_API_KEY，请在 .env 中配置')
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))

// 主入口：POST /api/agent/analyze
app.post(
  '/api/agent/analyze',
  async (
    req: Request,
    res: Response<AgentAnalyzeResult | { error: string }>
  ) => {
    const { document, options } = req.body as {
      document: AgentDocument
      options: AgentAnalyzeOptions
    }

    try {
      const prompt = buildPrompt(
        document,
        options.formSchema,
        options.instructions
      )
      const dashscopePayload = buildDashscopePayload(prompt) // 构造请求体（含 JSON Schema）
      const response = await fetch(DASHSCOPE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        },
        body: JSON.stringify(dashscopePayload),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(
          `DashScope 调用失败：${response.status} ${response.statusText} ${text}`
        )
      }

      const data = (await response.json()) as DashscopeResponse
      const rawContent = data.choices?.[0]?.message?.content // 可能是 字符串/数组/对象
      const payload = extractPayload(rawContent, options.formSchema) // 提取“有效载荷”
      const normalized = normalizeAgentResult(payload, options.formSchema) // 归一化为 AgentAnalyzeResult
      res.json(normalized)
    } catch (error) {
      console.error(error)
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : 'DashScope 调用异常' })
    }
  }
)

// 启动 HTTP 服务器
app.listen(PORT, () => {
  console.log(`[agent-server] listening on http://localhost:${PORT}`)
})

/**
 * 构造 DashScope 请求体（指定模型 + JSON Schema 强约束）
 */
function buildDashscopePayload(
  prompt: string
): DashscopePayload {
  return {
    model: DASHSCOPE_MODEL,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'agent_extract_schema',
        schema: agentSchema(),
      },
    },
    messages: [
      {
        role: 'system',
        content:
          '你是信息抽取助手，请严格根据用户提供的表单字段要求，从文档中提取对应信息，并返回符合 JSON Schema 的结果。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  }
}

/**
 * 构造提示词：
 * - 合成表单字段及其同义词/描述
 * - 附带用户文档文本
 */
function buildPrompt(
  document: AgentDocument,
  fields: AgentFormField[],
  instructions?: string
) {
  const fieldLines = fields
    .map((field) => {
      const synonyms = field.synonyms?.length ? `同义词: ${field.synonyms.join(', ')}.` : ''
      return `- ${field.label} (id: ${field.id}) ${synonyms} 说明: ${
        field.description ?? '无'
      }`
    })
    .join('\n')

  return `
请阅读以下文档内容，并提取指定字段的值。如果无法确定，请将该字段的 value 设为 null，并在 rationale 中说明原因。

额外说明: ${instructions ?? '无'}

待提取字段:
${fieldLines}

文档内容:
${document.content}

如果文档包含额外操作或流程建议，请返回 actions 数组，每项包含 type、target(可选)、payload(可选)、confidence(0~1) 和 rationale。
`
}

function agentSchema() {
  return {
    type: 'object',
    properties: {
      backend: { type: 'string' },
      summary: { type: 'string' },
      diagnostics: {
        type: 'array',
        items: { type: 'string' },
      },
      extractedPairs: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
      fields: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            fieldId: { type: 'string' },
            label: { type: 'string' },
            value: { type: ['string', 'null'] },
            confidence: { type: 'number' },
            sourceText: { type: ['string', 'null'] },
            rationale: { type: ['string', 'null'] },
          },
          required: ['fieldId', 'label', 'value', 'confidence'],
        },
      },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            target: { type: 'string' },
            payload: { type: 'object' },
            confidence: { type: 'number' },
            rationale: { type: 'string' },
          },
          required: ['type', 'confidence'],
        },
      },
    },
    required: ['fields', 'extractedPairs'],
  }
}

interface DashscopePayload {
  model: string
  response_format: {
    type: string
    json_schema: {
      name: string
      schema: unknown
    }
  }
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
}

interface DashscopeResponse {
  id: string
  choices?: Array<{
    index: number
    finish_reason: string
    message?: DashscopeMessage
  }>
  usage?: unknown
}

type DashscopeMessage =
  | {
      role: 'assistant' | 'system'
      content?: string
    }
  | {
      role: 'assistant' | 'system'
      content?: Array<
        | string
        | {
            type: string
            text?: string
            [key: string]: unknown
          }
      >
    }

function extractPayload(
  content: DashscopeMessage['content'],
  formSchema: AgentFormField[]
): Record<string, unknown> {
  if (!content) return {}
  if (typeof content === 'string') {
    const trimmed = content.trim()
    if (!trimmed) return {}
    const parsed = tryParseJSON(trimmed)
    if (parsed && typeof parsed === 'object') {
      return applySchemaDefaults(parsed as Record<string, unknown>, formSchema)
    }
    return applySchemaDefaults({ summary: trimmed }, formSchema)
  }
  if (Array.isArray(content)) {
    const concatenated = content
      .map((chunk) => {
        if (typeof chunk === 'string') return chunk
        if (chunk && typeof chunk === 'object' && 'text' in chunk) {
          return typeof (chunk as { text?: string }).text === 'string'
            ? (chunk as { text?: string }).text
            : ''
        }
        return ''
      })
      .join('')
      .trim()
    if (!concatenated) return {}
    const parsed = tryParseJSON(concatenated)
    if (parsed && typeof parsed === 'object') {
      return applySchemaDefaults(parsed as Record<string, unknown>, formSchema)
    }
    return applySchemaDefaults({ summary: concatenated }, formSchema)
  }
  if (typeof content === 'object') {
    return applySchemaDefaults(content as Record<string, unknown>, formSchema)
  }
  return applySchemaDefaults({}, formSchema)
}

function normalizeAgentResult(
  payload: Record<string, unknown>,
  formSchema: AgentFormField[]
): AgentAnalyzeResult {
  const backend =
    typeof payload.backend === 'string'
      ? payload.backend
      : `dashscope:${DASHSCOPE_MODEL}`

  const diagnostics = Array.isArray(payload.diagnostics)
    ? payload.diagnostics.filter((item): item is string => typeof item === 'string')
    : undefined

  const summary =
    typeof payload.summary === 'string' ? payload.summary : undefined

  const extractedPairs =
    payload.extractedPairs && typeof payload.extractedPairs === 'object'
      ? Object.entries(payload.extractedPairs).reduce<Record<string, string>>(
          (acc, [key, value]) => {
            if (typeof value === 'string') {
              acc[key] = value
            }
            return acc
          },
          {}
        )
      : {}

  const actions = Array.isArray(payload.actions)
    ? payload.actions
        .map((item) => normalizeAction(item))
        .filter((action): action is AgentAction => action !== null)
    : []

  const rawGroups = Array.isArray((payload as Record<string, unknown>).groups)
    ? (payload as { groups: unknown[] }).groups
    : Array.isArray((payload as Record<string, unknown>).fieldGroups)
      ? (payload as { fieldGroups: unknown[] }).fieldGroups
      : []

  const fieldGroups = rawGroups
    .map((item, index) => normalizeGroup(item, index))
    .filter((group): group is AgentFieldGroup => group !== null)

  const groupOptionMap = fieldGroups.reduce<Record<string, AgentFieldOption[]>>(
    (acc, group) => {
      Object.entries(group.fields).forEach(([fieldId, option]) => {
        const optionWithMeta: AgentFieldOption = {
          ...option,
          groupId: option.groupId ?? group.id,
          groupLabel: option.groupLabel ?? group.label,
          confidence: option.confidence ?? group.confidence,
        }
        if (!acc[fieldId]) {
          acc[fieldId] = []
        }
        acc[fieldId].push(optionWithMeta)
      })
      return acc
    },
    {}
  )

  let fields: AgentFieldInference[] = []

  if (Array.isArray(payload.fields)) {
    fields = payload.fields
      .map((item) => normalizeFieldInference(item, formSchema, groupOptionMap))
      .filter((item): item is AgentFieldInference => item !== null)
  } else {
    fields = formSchema.map((field) =>
      buildFieldFromObject(field, payload[field.id], groupOptionMap)
    )
  }

  for (const field of fields) {
    if (field.value) {
      extractedPairs[field.fieldId] = field.value
    }
  }

  return {
    backend,
    fields,
    summary,
    diagnostics,
    extractedPairs,
    actions,
    fieldGroups,
  }
}

function normalizeFieldInference(
  item: unknown,
  formSchema: AgentFormField[],
  groupOptionMap: Record<string, AgentFieldOption[]>
): AgentFieldInference | null {
  if (!item || typeof item !== 'object') return null
  const record = item as Record<string, unknown>
  const fieldId = typeof record.fieldId === 'string' ? record.fieldId : null
  if (!fieldId) return null
  const schema = formSchema.find((field) => field.id === fieldId)
  const label =
    typeof record.label === 'string'
      ? record.label
      : schema
        ? schema.label
        : fieldId
  const rawValue = record.value
  let value =
    rawValue === null
      ? null
      : typeof rawValue === 'string'
        ? rawValue
        : rawValue != null
          ? String(rawValue)
          : null
  let confidence =
    typeof record.confidence === 'number'
      ? clampConfidence(record.confidence)
      : value
        ? 0.75
        : 0
  const rationale =
    typeof record.rationale === 'string'
      ? record.rationale
      : record.rationale != null
        ? String(record.rationale)
        : undefined
  const sourceText =
    typeof record.sourceText === 'string'
      ? record.sourceText
      : undefined
  let options: AgentFieldOption[] | undefined
  if (Array.isArray(record.options)) {
    options = normalizeOptions(record.options)
  } else if (Array.isArray(record.value)) {
    options = normalizeOptions(record.value)
  }
  const groupExtras = groupOptionMap[fieldId]
  if (groupExtras?.length) {
    options = mergeOptions(options, groupExtras)
    if (!value) {
      value = groupExtras[0].value
      confidence = groupExtras[0].confidence ?? confidence
    }
  }
  if (!value && options?.length) {
    value = options[0].value
  }
  if (value && options?.length) {
    const matched = options.find((option) => option.value === value)
    if (matched?.confidence !== undefined) {
      confidence = matched.confidence
    }
  }

  return {
    fieldId,
    label,
    value: value ?? null,
    confidence,
    rationale,
    sourceText,
    options,
  }
}

function buildFieldFromObject(
  field: AgentFormField,
  raw: unknown,
  groupOptionMap: Record<string, AgentFieldOption[]>
): AgentFieldInference {
  let value: string | null = null
  let confidence = 0
  let rationale: string | undefined
  let sourceText: string | undefined
  let options: AgentFieldOption[] | undefined

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const entry = raw as Record<string, unknown>
    if (typeof entry.value === 'string') {
      value = entry.value
      confidence =
        typeof entry.confidence === 'number'
          ? clampConfidence(entry.confidence)
          : Math.min(0.9, 0.75 + 0.05 * (entry.value?.toString().length ?? 0) / 20)
    } else if (Array.isArray(entry.value)) {
      options = normalizeOptions(entry.value)
      if (options.length) {
        value = options[0].value
        confidence = options[0].confidence ?? 0.78
      }
    } else if (entry.value != null) {
      value = String(entry.value)
      confidence =
        typeof entry.confidence === 'number'
          ? clampConfidence(entry.confidence)
          : 0.65
    }
    if (typeof entry.rationale === 'string') {
      rationale = entry.rationale
    }
    if (typeof entry.sourceText === 'string') {
      sourceText = entry.sourceText
    }
  } else if (typeof raw === 'string') {
    value = raw
    confidence = Math.min(0.85, 0.65 + raw.length * 0.01)
  } else if (Array.isArray(raw)) {
    options = normalizeOptions(raw)
    if (options.length) {
      value = options[0].value
      confidence = options[0].confidence ?? 0.72
    }
  } else if (raw != null) {
    value = String(raw)
    confidence = 0.55
  }

  const groupExtras = groupOptionMap[field.id]
  if (groupExtras?.length) {
    options = mergeOptions(options, groupExtras)
    if (!value) {
      value = groupExtras[0].value
      confidence = groupExtras[0].confidence ?? confidence
    }
  }

  if (value && options?.length) {
    const matched = options.find((option) => option.value === value)
    if (matched?.confidence !== undefined) {
      confidence = matched.confidence
    }
  }

  return {
    fieldId: field.id,
    label: field.label,
    value,
    confidence,
    rationale,
    sourceText,
    options,
  }
}

function normalizeAction(item: unknown): AgentAction | null {
  if (!item || typeof item !== 'object') return null
  const record = item as Record<string, unknown>
  const type = typeof record.type === 'string' ? record.type : null
  if (!type) return null
  const target = typeof record.target === 'string' ? record.target : undefined
  const payload =
    record.payload && typeof record.payload === 'object'
      ? (record.payload as Record<string, unknown>)
      : undefined
  const confidence = clampConfidence(
    typeof record.confidence === 'number' ? record.confidence : 0.65
  )
  const rationale =
    typeof record.rationale === 'string'
      ? record.rationale
      : record.rationale != null
        ? String(record.rationale)
        : undefined

  return {
    type,
    target,
    payload,
    confidence,
    rationale,
  }
}

function tryParseJSON(input: string): unknown | null {
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

function clampConfidence(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function normalizeOptions(
  raw: unknown,
  meta?: { groupId?: string; groupLabel?: string }
): AgentFieldOption[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item): AgentFieldOption | null => {
      if (typeof item === 'string') {
        return {
          value: item,
          confidence: Math.min(0.85, 0.65 + item.length * 0.01),
          groupId: meta?.groupId,
          groupLabel: meta?.groupLabel,
        }
      }
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const value =
        typeof record.value === 'string'
          ? record.value
          : record.value != null
            ? String(record.value)
            : null
      if (!value) return null
      return {
        value,
        confidence:
          typeof record.confidence === 'number'
            ? clampConfidence(record.confidence)
            : undefined,
        rationale:
          typeof record.rationale === 'string'
            ? record.rationale
            : record.rationale != null
              ? String(record.rationale)
              : undefined,
        sourceText:
          typeof record.sourceText === 'string' ? record.sourceText : undefined,
        groupId: meta?.groupId,
        groupLabel: meta?.groupLabel,
      }
    })
    .filter((item): item is AgentFieldOption => item !== null)
}

function mergeOptions(
  base: AgentFieldOption[] | undefined,
  extras: AgentFieldOption[]
): AgentFieldOption[] {
  const map = new Map<string, AgentFieldOption>()
  for (const option of base ?? []) {
    map.set(optionKey(option), option)
  }
  for (const option of extras) {
    const key = optionKey(option)
    if (!map.has(key)) {
      map.set(key, option)
    }
  }
  return Array.from(map.values())
}

function optionKey(option: AgentFieldOption): string {
  return `${option.groupId ?? 'field'}::${option.value}`
}

function normalizeGroup(
  item: unknown,
  index: number
): AgentFieldGroup | null {
  if (!item || typeof item !== 'object') return null
  const record = item as Record<string, unknown>
  const rawId = record.id
  const id =
    typeof rawId === 'string' && rawId.trim().length
      ? rawId
      : `group-${index + 1}`
  const label =
    typeof record.label === 'string' ? record.label : undefined
  const confidence =
    typeof record.confidence === 'number'
      ? clampConfidence(record.confidence)
      : undefined
  const rationale =
    typeof record.rationale === 'string'
      ? record.rationale
      : record.rationale != null
        ? String(record.rationale)
        : undefined
  const fields: Record<string, AgentFieldOption> = {}
  const rawFields = record.fields
  if (rawFields && typeof rawFields === 'object') {
    for (const [fieldId, value] of Object.entries(
      rawFields as Record<string, unknown>
    )) {
      const options = normalizeOptions(value, {
        groupId: id,
        groupLabel: label,
      })
      if (options.length) {
        fields[fieldId] = options[0]
      } else if (typeof value === 'string') {
        fields[fieldId] = {
          value,
          groupId: id,
          groupLabel: label,
        }
      }
    }
  }
  if (!Object.keys(fields).length) return null
  return {
    id,
    label,
    confidence,
    rationale,
    fields,
  }
}

function applySchemaDefaults(
  payload: Record<string, unknown>,
  formSchema: AgentFormField[]
): Record<string, unknown> {
  for (const field of formSchema) {
    if (!(field.id in payload)) {
      payload[field.id] = null
    }
  }
  return payload
}
