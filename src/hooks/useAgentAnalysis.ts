/**
 * useAgentAnalysis（中文注释版）
 * - 负责：解析文件 → 调用智能体 → 归档状态/结果/错误
 * - 提供 analyzeFile 与 reset，供界面调用
 */
import { useCallback, useState } from 'react'
import {
  analyzeDocumentWithDefaultAgent,
  type AgentAnalyzeResult,
  type AgentFormField,
} from '../agent'
import {
  parseFileToAgentDocument,
  SUPPORTED_FORMAT_LABEL,
  EmptyFileError,
  UnsupportedFileError,
} from '../utils/fileParser'

export type AnalysisStatus = 'idle' | 'loading' | 'error' | 'success'

export interface UseAgentAnalysis {
  status: AnalysisStatus
  result: AgentAnalyzeResult | null
  parsedFormat: string
  parsingNotes: string[]
  error: string | null
  analyzeFile: (file: File, formSchema: AgentFormField[]) => Promise<void>
  reset: () => void
}

export function useAgentAnalysis(): UseAgentAnalysis {
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [result, setResult] = useState<AgentAnalyzeResult | null>(null)
  const [parsedFormat, setParsedFormat] = useState('')
  const [parsingNotes, setParsingNotes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setResult(null)
    setParsedFormat('')
    setParsingNotes([])
    setError(null)
  }, [])

  const analyzeFile = useCallback(
    async (file: File, formSchema: AgentFormField[]) => {
      setStatus('loading')
      setResult(null)
      setParsedFormat('')
      setParsingNotes([])
      setError(null)
      try {
        const parsed = await parseFileToAgentDocument(file)
        setParsedFormat(parsed.formatLabel)
        setParsingNotes(parsed.notes)

        const raw = await analyzeDocumentWithDefaultAgent(parsed.document, {
          formSchema,
        })
        setResult(raw)

        const recognized = Array.isArray(raw.fields)
          ? raw.fields.some((f) => (f.value ?? f.options?.[0]?.value)?.toString().trim())
          : false
        if (!recognized) {
          setError(
            `未能识别出可填充的字段。请确认文档包含清晰的字段说明。当前支持的格式：${SUPPORTED_FORMAT_LABEL}。`
          )
        } else {
          setError(null)
        }
        setStatus('success')
      } catch (cause) {
        if (cause instanceof UnsupportedFileError || cause instanceof EmptyFileError) {
          setError(cause.message)
        } else if (cause instanceof Error) {
          setError(cause.message || '智能体处理文件失败。')
        } else {
          setError('智能体处理文件失败。')
        }
        setStatus('error')
        setResult(null)
      }
    },
    []
  )

  return { status, result, parsedFormat, parsingNotes, error, analyzeFile, reset }
}
