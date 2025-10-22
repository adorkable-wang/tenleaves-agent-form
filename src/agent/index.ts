import { RemoteAgentBackend } from './remoteAgent'
import type {
  AgentAnalyzeOptions,
  AgentAnalyzeResult,
  AgentBackend,
  AgentDocument,
} from './types'

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

const sharedBackend: AgentBackend = new RemoteAgentBackend({
  endpoint: import.meta.env.VITE_AGENT_ENDPOINT ?? '/api/agent/analyze',
  apiKey: import.meta.env.VITE_AGENT_API_KEY,
})
const sharedRunner = new AgentRunner(sharedBackend)

export async function analyzeDocumentWithDefaultAgent(
  document: AgentDocument,
  options: AgentAnalyzeOptions
): Promise<AgentAnalyzeResult> {
  return sharedRunner.analyze(document, options)
}

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
