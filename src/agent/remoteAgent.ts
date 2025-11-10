/**
 * RemoteAgentBackend（远程智能体后端）
 *
 * 作用：通过 HTTP 调用后端 /api/agent/analyze 接口，
 * 传入 { document, options }，得到标准化的 AgentAnalyzeResult。
 */
import type {
  AgentAnalyzeOptions,
  AgentAnalyzeResult,
  AgentBackend,
  AgentDocument,
} from './types'

export interface RemoteAgentConfig {
  endpoint: string
  apiKey?: string
}

export class RemoteAgentBackend implements AgentBackend {
  readonly name: string
  private readonly endpoint: string
  private readonly apiKey?: string

  constructor(config: RemoteAgentConfig) {
    this.endpoint = config.endpoint
    this.apiKey = config.apiKey
    this.name = `remote-agent:${resolveHostname(config.endpoint)}`
  }

  /**
   * analyzeDocument
   * - 将前端解析出的文档与选项发送到后端服务
   * - 失败时抛错并包含状态码与返回文本
   */
  async analyzeDocument(
    document: AgentDocument,
    options: AgentAnalyzeOptions
  ): Promise<AgentAnalyzeResult> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        document,
        options,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `远程智能体调用失败：${response.status} ${response.statusText} ${errorText}`
      )
    }

    const result = (await response.json()) as AgentAnalyzeResult
    return result
  }
}

// 解析 endpoint 的主机名：用于构造 backend.name 展示
function resolveHostname(endpoint: string): string {
  try {
    if (typeof window !== 'undefined') {
      return new URL(endpoint, window.location.origin).hostname
    }
    return new URL(endpoint).hostname
  } catch {
    return 'custom-endpoint'
  }
}
