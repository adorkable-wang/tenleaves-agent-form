/**
 * 轻量客户端工厂（中文注释版）
 * - 在前端直接创建一个“远程智能体客户端”，对外提供 analyze(document, options)
 * - 内部复用 createRemoteAgentRunner，便于与现有调用栈对齐
 */
import type { AgentAnalyzeOptions, AgentAnalyzeResult, AgentDocument } from '../agent'
import { createRemoteAgentRunner } from '../agent'

export interface AgentClientConfig {
  endpoint: string
  apiKey?: string
}

export interface AgentClient {
  analyze(document: AgentDocument, options: AgentAnalyzeOptions): Promise<AgentAnalyzeResult>
}

/**
 * 创建客户端
 * - endpoint：后端接口地址（可走 Vite 代理）
 * - apiKey：可选，转发到后端用于鉴权
 */
export function createAgentClient(config: AgentClientConfig): AgentClient {
  const runner = createRemoteAgentRunner({ endpoint: config.endpoint, apiKey: config.apiKey })
  return {
    analyze: (document, options) => runner.analyze(document, options),
  }
}
