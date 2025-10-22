import type {
  AgentAnalyzeOptions,
  AgentAnalyzeResult,
  AgentBackend,
  AgentDocument,
} from './types'

interface RemoteAgentConfig {
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
