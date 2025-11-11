import {
  DASHSCOPE_API_KEY,
  DASHSCOPE_ENDPOINT,
  DASHSCOPE_MODEL,
  LLM_TIMEOUT_MS,
  LLM_RETRIES,
  LLM_TIMEOUT_ENABLED,
} from '../../config'
import { agentSchema } from '../../schemas/jsonSchema'
import { fetchWithTimeout } from '../../utils/fetchWithTimeout'

type DashscopeMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface DashscopePayload {
  model: string
  response_format: {
    type: string
    json_schema: { name: string; schema: unknown; strict?: boolean }
  }
  messages: DashscopeMessage[]
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

/**
 * 发送到 DashScope：使用 JSON Schema 约束返回
 */
export async function sendDashscope(prompt: string): Promise<DashscopeResponse> {
  const payload: DashscopePayload = {
    model: DASHSCOPE_MODEL,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'agent_extract_schema',
        schema: agentSchema(),
        strict: true,
      },
    },
    messages: [
      {
        role: 'system',
        content:
          '你是信息抽取助手，请严格根据用户提供的表单字段要求，从文档中提取对应信息，并返回符合 JSON Schema 的结果。',
      },
      { role: 'user', content: prompt },
    ],
  }

  const res = await fetchWithTimeout(
    DASHSCOPE_ENDPOINT,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify(payload),
    },
    {
      timeoutMs: LLM_TIMEOUT_MS,
      retries: LLM_RETRIES,
      enableTimeout: LLM_TIMEOUT_ENABLED,
    }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DashScope 调用失败：${res.status} ${res.statusText} ${text}`)
  }
  return (await res.json()) as DashscopeResponse
}
