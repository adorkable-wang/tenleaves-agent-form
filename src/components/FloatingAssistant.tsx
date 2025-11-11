/**
 * 悬浮聊天助手（中文注释版）
 * - 固定右下角的按钮（Portal 到 body，不受父容器影响）
 * - 打开对话框（也 Portal 到 body），支持外部点击/ESC 关闭
 * - 单输入框：文本输入 + 粘贴文件 + 拖拽文件 + 点击“＋”选择文件
 * - 提交后调用智能体 → 输出消息 → 回填表单并高亮 → 派发事件
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AgentAnalyzeResult, AgentDocument, AgentFieldGroup, AgentFormField } from '../agent'
import { analyzeDocumentWithDefaultAgent } from '../agent'
import {
  parseFileToAgentDocument,
  ACCEPTED_FILE_EXTENSIONS,
  SUPPORTED_FORMAT_LABEL,
} from '../utils/fileParser'
import { buildValuesFromGroup, emitAutofillEvent } from '../agent/utils'
import { type ProgressStep } from './assistant/types'
import TaskList from './assistant/TaskList'
import ResultSection from './assistant/ResultSection'
import AssistantInputArea from './assistant/InputArea'
import { useAssistantTasks, type TaskLog } from '../hooks/useAssistantTasks'
import { useGroupPreviews } from '../hooks/useGroupPreviews'
import { useProgressTimer } from '../hooks/useProgressTimer'

interface Props {
  schema: AgentFormField[]
  onApply: (values: Record<string, string>, result: AgentAnalyzeResult) => void
}

export const FloatingAssistant: React.FC<Props> = ({ schema, onApply }) => {
  // 打开状态 + 开合动画阶段
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<'closed' | 'enter' | 'open' | 'exit'>('closed')
  // 会话/输入/状态
  const [inputText, setInputText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  // 进度与用时
  const { elapsedMs, startTimer, stopTimer } = useProgressTimer()
  const lastSubmissionRef = useRef<{
    docPayload: AgentDocument
    label: string
  } | null>(null)
  const [activeResult, setActiveResult] = useState<AgentAnalyzeResult | null>(null)
  const [manualGroupId, setManualGroupId] = useState<string | null>(null)
  const { tasks, appendTask, updateTask, clearTasks } = useAssistantTasks()
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const activeTaskIdRef = useRef<string | null>(null)
  useEffect(() => {
    activeTaskIdRef.current = activeTaskId
  }, [activeTaskId])

  // 引用与拖拽状态
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLButtonElement | null>(null)

  const toggle = () => {
    setOpen((v) => {
      const next = !v
      if (next) {
        setStage('enter')
        requestAnimationFrame(() => setStage('open'))
      } else {
        setStage('exit')
        window.setTimeout(() => setStage('closed'), 180)
      }
      return next
    })
  }

  const buildInitialSteps = useCallback(
    (mode: 'file' | 'text' | 'retry', detail?: string): ProgressStep[] => {
      const parseLabel = mode === 'file' ? '解析文件' : mode === 'retry' ? '复用内容' : '准备内容'
      const parseStatus = mode === 'file' ? 'active' : 'done'
      const parseDetail =
        detail ?? (mode === 'retry' ? '沿用上次内容' : mode === 'text' ? '文本输入' : undefined)
      const prepareStatus = mode === 'file' ? 'pending' : 'active'
      return [
        {
          id: 'parse',
          label: parseLabel,
          status: parseStatus,
          detail: parseDetail,
        },
        { id: 'prepare', label: '准备请求', status: prepareStatus },
        { id: 'await', label: '等待模型响应', status: 'pending' },
        { id: 'apply', label: '解析回填', status: 'pending' },
      ]
    },
    []
  )

  const updateTaskSteps = useCallback(
    (taskId: string, updates: Partial<Record<string, Partial<ProgressStep>>>) => {
      updateTask(taskId, (task) => ({
        ...task,
        steps: task.steps.map((step) =>
          updates[step.id] ? { ...step, ...updates[step.id]! } : step
        ),
      }))
    },
    [updateTask]
  )

  const groupPreviews = useGroupPreviews(activeResult, schema)

  const handleSelectTask = useCallback((task: TaskLog) => {
    setActiveResult(task.result ?? null)
    setManualGroupId(null)
    setActiveTaskId(task.id)
  }, [])

  const executeAnalysis = useCallback(
    async (taskId: string, docPayload: AgentDocument) => {
      updateTaskSteps(taskId, {
        prepare: { status: 'done' },
        await: { status: 'active' },
      })
      const result = await analyzeDocumentWithDefaultAgent(docPayload, {
        formSchema: schema,
      })
      if (activeTaskIdRef.current === taskId) {
        setActiveResult(result)
      }
      updateTask(taskId, (task) => ({
        ...task,
        status: 'success',
        durationMs: Date.now() - task.startedAt,
        result,
      }))
      setManualGroupId(null)
      updateTaskSteps(taskId, {
        await: { status: 'done' },
        apply: { status: 'active' },
      })
      setInputText('')
      setPendingFile(null)
      updateTaskSteps(taskId, {
        apply: { status: 'done' },
      })
    },
    [
      schema,
      updateTaskSteps,
      updateTask,
      setManualGroupId,
      setInputText,
      setPendingFile,
      setActiveResult,
    ]
  )

  const handleAnalysisError = useCallback(
    (taskId: string, message: string) => {
      setError(message)
      updateTask(taskId, (task) => ({
        ...task,
        status: 'error',
        error: message,
        durationMs: Date.now() - task.startedAt,
        steps: task.steps.map((step) =>
          step.status === 'active' ? { ...step, status: 'error', detail: message } : step
        ),
      }))
    },
    [updateTask]
  )

  const handleSubmit = useCallback(async () => {
    const file = pendingFile
    const text = inputText.trim()
    if (pending || (!file && !text)) return
    setPending(true)
    setError(null)
    setManualGroupId(null)
    setActiveResult(null)
    const mode: 'file' | 'text' = file ? 'file' : 'text'
    const taskId = `${Date.now()}`
    const taskLabel = file ? file.name : '文本输入'
    const initialSteps = buildInitialSteps(mode, file ? undefined : '文本输入')
    appendTask({
      id: taskId,
      label: taskLabel,
      status: 'pending',
      startedAt: Date.now(),
      steps: initialSteps,
    })
    setActiveTaskId(taskId)
    startTimer()
    try {
      let docPayload: AgentDocument
      if (file) {
        const parsed = await parseFileToAgentDocument(file)
        updateTaskSteps(taskId, {
          parse: { status: 'done', detail: parsed.formatLabel },
          prepare: { status: 'active' },
        })
        docPayload = parsed.document
      } else {
        docPayload = {
          kind: 'text',
          content: text,
          filename: 'input.txt',
        } as const
      }
      lastSubmissionRef.current = {
        docPayload,
        label: taskLabel,
      }
      await executeAnalysis(taskId, docPayload)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '智能体处理失败'
      handleAnalysisError(taskId, msg)
    } finally {
      setPending(false)
      stopTimer()
    }
  }, [
    pending,
    pendingFile,
    inputText,
    buildInitialSteps,
    updateTaskSteps,
    executeAnalysis,
    handleAnalysisError,
    startTimer,
    stopTimer,
    appendTask,
    setActiveResult,
    setActiveTaskId,
  ])

  const handleRetry = useCallback(async () => {
    if (pending) return
    const last = lastSubmissionRef.current
    if (!last) return
    setPending(true)
    setError(null)
    const taskId = `${Date.now()}`
    const retrySteps = buildInitialSteps('retry', last.label)
    appendTask({
      id: taskId,
      label: `${last.label}（重试）`,
      status: 'pending',
      startedAt: Date.now(),
      steps: retrySteps,
    })
    setActiveTaskId(taskId)
    setActiveResult(null)
    startTimer()
    try {
      await executeAnalysis(taskId, last.docPayload)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '智能体处理失败'
      handleAnalysisError(taskId, msg)
    } finally {
      setPending(false)
      stopTimer()
    }
  }, [
    pending,
    buildInitialSteps,
    executeAnalysis,
    handleAnalysisError,
    stopTimer,
    appendTask,
    startTimer,
    setActiveResult,
    setActiveTaskId,
  ])

  const handleApplyGroupFromAssistant = useCallback(
    (group: AgentFieldGroup) => {
      if (!activeResult) return
      const values = buildValuesFromGroup(group)
      if (!Object.keys(values).length) return
      onApply(values, activeResult)
      emitAutofillEvent(values, activeResult.backend)
      setManualGroupId(group.id)
    },
    [activeResult, onApply]
  )

  const buttonLabel = useMemo(() => (open ? '关闭助手' : '打开助手'), [open])

  // 打开时聚焦输入框
  useEffect(() => {
    if (open && stage === 'open') {
      textareaRef.current?.focus()
    }
  }, [open, stage])

  // 点击外部关闭 + ESC 关闭
  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (!dialogRef.current) return
      const target = e.target as Node
      const toggleBtn = containerRef.current
      if (toggleBtn && toggleBtn.contains(target)) return
      if (!dialogRef.current.contains(target)) {
        toggle()
      }
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggle()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  // 粘贴文件支持
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData?.files?.length) {
      const f = e.clipboardData.files[0]
      if (f) handleSelectFile(f)
    }
  }
  // 拖拽文件支持
  const onDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    if (e.dataTransfer?.files?.length) {
      const f = e.dataTransfer.files[0]
      if (f) handleSelectFile(f)
    }
    setDragActive(false)
  }
  const onDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    if (!dragActive) setDragActive(true)
  }
  const onDragLeave = () => setDragActive(false)
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!pending) void handleSubmit()
    }
  }

  // 自适应高度
  const autoGrow = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])
  useEffect(() => {
    autoGrow()
  }, [inputText, autoGrow])

  // 校验与选择文件（类型/大小）
  const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB
  // 统一通过文件解析工具导出的可接受扩展名，避免在多处维护
  const ACCEPT_EXTS_SET = useMemo(() => {
    const set = new Set<string>()
    for (const ext of ACCEPTED_FILE_EXTENSIONS) {
      const cleaned = ext.startsWith('.') ? ext.slice(1) : ext
      set.add(cleaned.toLowerCase())
    }
    return set
  }, [])
  const isAcceptExt = (name: string) => {
    const lower = name.toLowerCase()
    const idx = lower.lastIndexOf('.')
    if (idx === -1) return false
    const ext = lower.slice(idx + 1)
    return ACCEPT_EXTS_SET.has(ext)
  }
  const handleSelectFile = (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setError(`文件过大（${(file.size / 1024 / 1024).toFixed(2)} MB），请限制在 10 MB 内。`)
      return
    }
    if (!isAcceptExt(file.name)) {
      setError(`不支持的文件类型，请上传常见文本/办公文档（${SUPPORTED_FORMAT_LABEL}）。`)
      return
    }
    setPendingFile(file)
    setError(null)
  }

  return (
    <div className="floating-assistant">
      {open && stage !== 'closed'
        ? createPortal(
            <div
              className={
                'assistant-dialog ' +
                (stage === 'enter'
                  ? 'opacity-0 translate-y-2 scale-95'
                  : stage === 'exit'
                    ? 'opacity-0 translate-y-1 scale-95'
                    : 'opacity-100 translate-y-0 scale-100')
              }
              role="dialog"
              aria-label="智能助手"
              ref={dialogRef}
            >
              <div className="assistant-header">
                <strong>智能助手</strong>
                <button
                  type="button"
                  className="assistant-close"
                  onClick={toggle}
                  aria-label={buttonLabel}
                >
                  ✕
                </button>
              </div>
              <div className="assistant-body space-y-4">
                {error ? (
                  <p className="error mt-0 text-sm">
                    {error}
                    {lastSubmissionRef.current ? (
                      <button
                        type="button"
                        className="ml-2 text-indigo-700 underline disabled:opacity-50"
                        onClick={() => {
                          void handleRetry()
                        }}
                        disabled={pending}
                      >
                        重试
                      </button>
                    ) : null}
                  </p>
                ) : null}
                <TaskList
                  tasks={tasks}
                  activeTaskId={activeTaskId}
                  activeElapsedMs={elapsedMs}
                  onSelectTask={handleSelectTask}
                  onClear={() => {
                    clearTasks()
                    setActiveTaskId(null)
                    setActiveResult(null)
                    setManualGroupId(null)
                    setError(null)
                    setPending(false)
                    stopTimer()
                  }}
                />
                <ResultSection
                  previews={groupPreviews}
                  manualGroupId={manualGroupId}
                  sourceLabel={lastSubmissionRef.current?.label ?? undefined}
                  canRetry={Boolean(lastSubmissionRef.current)}
                  pending={pending}
                  onRetry={() => {
                    void handleRetry()
                  }}
                  onApply={handleApplyGroupFromAssistant}
                />
              </div>
              <AssistantInputArea
                pending={pending}
                pendingFile={pendingFile}
                inputText={inputText}
                dragActive={dragActive}
                textareaRef={textareaRef}
                fileInputRef={fileInputRef}
                onInputChange={setInputText}
                onPaste={onPaste}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onKeyDown={onKeyDown}
                onSelectFileClick={() => fileInputRef.current?.click()}
                onFileChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleSelectFile(f)
                }}
                onRemoveFile={() => setPendingFile(null)}
                onSubmit={() => {
                  void handleSubmit()
                }}
              />
            </div>,
            document.body
          )
        : null}
      {createPortal(
        <button
          ref={containerRef}
          type="button"
          className={`assistant-toggle ${open ? 'assistant-toggle--open' : ''}`}
          onClick={toggle}
          aria-expanded={open}
          aria-label={buttonLabel}
        >
          <span className="i-material-symbols-smart-toy-rounded text-2xl" />
        </button>,
        window.document.body
      )}
    </div>
  )
}

export default FloatingAssistant
