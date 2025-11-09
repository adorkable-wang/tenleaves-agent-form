export type AgentDocument =
  | {
      kind: 'text'
      content: string
      filename?: string
    }

export interface AgentFormField {
  id: string
  label: string
  description?: string
  required?: boolean
  synonyms?: string[]
  example?: string
}

export interface AgentAnalyzeOptions {
  formSchema: AgentFormField[]
  instructions?: string
  metadata?: Record<string, unknown>
}

export interface AgentFieldOption {
  value: string
  confidence?: number
  rationale?: string
  sourceText?: string
  groupId?: string
  groupLabel?: string
}

export interface AgentAction {
  type: string
  target?: string
  payload?: Record<string, unknown>
  confidence: number
  rationale?: string
}

export interface AgentFieldGroup {
  id: string
  label?: string
  confidence?: number
  rationale?: string
  fieldCandidates: Record<string, AgentFieldOption[]>
}

export interface AgentAnalyzeResult {
  backend: string
  summary?: string
  diagnostics?: string[]
  extractedPairs: Record<string, string>
  actions?: AgentAction[]
  fieldGroups?: AgentFieldGroup[]
  autoSelectGroupId?: string | null
}

export interface AgentBackend {
  readonly name: string
  analyzeDocument(
    document: AgentDocument,
    options: AgentAnalyzeOptions
  ): Promise<AgentAnalyzeResult>
}
