/**
 * 智能体运行器（前端调用层）
 *
 * 作用：封装对后端“远程智能体”接口的调用，提供统一的 analyze(document, options)。
 * - 默认使用 RemoteAgentBackend（通过环境变量配置 endpoint 和 apiKey）。
 */
import { RemoteAgentBackend } from './remoteAgent'
import type {
  AgentAnalyzeOptions,
  AgentAnalyzeResult,
  AgentBackend,
  AgentDocument,
} from './types'

/**
 * AgentRunner
 * - 接收具体 Backend（例如 RemoteAgentBackend），对外提供统一 analyze 方法。
 */
export class AgentRunner {
  private readonly backend: AgentBackend

  constructor(backend: AgentBackend) {
    this.backend = backend
  }

  async analyze(
    document: AgentDocument,
    options: AgentAnalyzeOptions
  ): Promise<AgentAnalyzeResult> {
    return this.backend.analyzeDocument(document, options)
  }

  get name() {
    return this.backend.name
  }
}

// 共享的默认 Backend 与 Runner（基于环境变量）
const sharedBackend: AgentBackend = new RemoteAgentBackend({
  endpoint: import.meta.env.VITE_AGENT_ENDPOINT ?? '/api/agent/analyze',
  apiKey: import.meta.env.VITE_AGENT_API_KEY,
})
const sharedRunner = new AgentRunner(sharedBackend)

/**
 * analyzeDocumentWithDefaultAgent
 * - 使用共享 Runner 调用后端智能体
 */
export async function analyzeDocumentWithDefaultAgent(
  document: AgentDocument,
  options: AgentAnalyzeOptions
): Promise<AgentAnalyzeResult> {
  return sharedRunner.analyze(document, options)
}

/**
 * createRemoteAgentRunner
 * - 按需创建一个使用远程后端的 Runner（可在不同 endpoint 之间切换）
 */
export function createRemoteAgentRunner(config: {
  endpoint: string
  apiKey?: string
}): AgentRunner {
  return new AgentRunner(new RemoteAgentBackend(config))
}

export type {
  AgentAnalyzeOptions,
  AgentAnalyzeResult,
  AgentBackend,
  AgentDocument,
} from './types'
export type {
  AgentFieldInference,
  AgentFormField,
  AgentFieldOption,
  AgentFieldGroup,
  AgentAction,
} from './types'
