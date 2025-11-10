/**
 * 悬浮聊天助手（中文注释版）
 * - 固定右下角的按钮（Portal 到 body，不受父容器影响）
 * - 打开对话框（也 Portal 到 body），支持外部点击/ESC 关闭
 * - 单输入框：文本输入 + 粘贴文件 + 拖拽文件 + 点击“＋”选择文件
 * - 提交后调用智能体 → 输出消息 → 回填表单并高亮 → 派发事件
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type {
  AgentAnalyzeResult,
  AgentDocument,
  AgentFieldGroup,
  AgentFormField,
} from "../agent";
import { analyzeDocumentWithDefaultAgent } from "../agent";
import {
  parseFileToAgentDocument,
  ACCEPTED_FILE_EXTENSIONS,
  ACCEPT_ATTRIBUTE_VALUE,
  SUPPORTED_FORMAT_LABEL,
} from "../utils/fileParser";
import {
  buildValuesFromGroup,
  chooseInitialValuesFromResult,
  emitAutofillEvent,
} from "../agent/utils";
import AssistantProgress, { type ProgressStep } from "./AssistantProgress";

// 聊天消息结构（包含时间戳，便于显示发送时间）
type ChatMsg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
};

type GroupPreview = {
  group: AgentFieldGroup;
  entries: Array<{
    fieldId: string;
    label: string;
    value: string;
    confidence?: number;
  }>;
  extraCount: number;
};

interface Props {
  schema: AgentFormField[];
  onApply: (values: Record<string, string>, result: AgentAnalyzeResult) => void;
}

export const FloatingAssistant: React.FC<Props> = ({ schema, onApply }) => {
  // 打开状态 + 开合动画阶段
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"closed" | "enter" | "open" | "exit">(
    "closed"
  );
  // 会话/输入/状态
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputText, setInputText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  // 进度与用时
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const tickRef = useRef<number | null>(null);
  const startAtRef = useRef<number | null>(null);
  const lastSubmissionRef = useRef<{ docPayload: AgentDocument; label: string } | null>(null);
  const [lastResult, setLastResult] = useState<AgentAnalyzeResult | null>(null);
  // 引用与拖拽状态
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLButtonElement | null>(null);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        setStage("enter");
        requestAnimationFrame(() => setStage("open"));
      } else {
        setStage("exit");
        window.setTimeout(() => setStage("closed"), 180);
      }
      return next;
    });
  };

  const addMsg = useCallback((role: ChatMsg["role"], content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()) + Math.random(), role, content, ts: Date.now() },
    ]);
  }, []);

  const computeInitialFillValuesFromResult = useCallback(
    (result: AgentAnalyzeResult) => chooseInitialValuesFromResult(result),
    []
  );

  const formatAssistantSummary = (result: AgentAnalyzeResult): string => {
    const lines: string[] = [];
    if (result.summary) lines.push(`摘要：${result.summary}`);
    const groups = result.fieldGroups ?? [];
    groups.forEach((group, index) => {
      const headerConf =
        group.confidence != null
          ? `${Math.round(group.confidence * 100)}%`
          : "—";
      lines.push(`分组 ${index + 1}（ID: ${group.id}，置信度 ${headerConf}）`);
      const candidates = group.fieldCandidates;
      Object.entries(candidates).forEach(([fieldId, opts]) => {
        if (!opts?.length) return;
        const best = opts[0];
        const conf =
          best.confidence != null
            ? `${Math.round(best.confidence * 100)}%`
            : "—";
        lines.push(`- ${fieldId}: ${best.value || "（空）"}（置信度 ${conf}）`);
      });
    });
    if (!groups.length) {
      lines.push("（未识别到任何分组）");
    }
    return lines.join("\n");
  };

  const startTimer = useCallback(() => {
    startAtRef.current = Date.now();
    setElapsedMs(0);
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      if (startAtRef.current) {
        setElapsedMs(Date.now() - startAtRef.current);
      }
    }, 200);
  }, []);

  const stopTimer = useCallback(() => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const buildInitialSteps = useCallback(
    (mode: "file" | "text" | "retry", detail?: string): ProgressStep[] => {
      const parseLabel =
        mode === "file" ? "解析文件" : mode === "retry" ? "复用内容" : "准备内容";
      const parseStatus = mode === "file" ? "active" : "done";
      const parseDetail =
        detail ??
        (mode === "retry"
          ? "沿用上次内容"
          : mode === "text"
          ? "文本输入"
          : undefined);
      const prepareStatus = mode === "file" ? "pending" : "active";
      return [
        { id: "parse", label: parseLabel, status: parseStatus, detail: parseDetail },
        { id: "prepare", label: "准备请求", status: prepareStatus },
        { id: "await", label: "等待模型响应", status: "pending" },
        { id: "apply", label: "解析回填", status: "pending" },
      ];
    },
    []
  );

  const updateSteps = useCallback((updates: Partial<Record<string, Partial<ProgressStep>>>) => {
    setProgressSteps((prev) =>
      prev.map((step) =>
        updates[step.id] ? { ...step, ...updates[step.id]! } : step
      )
    );
  }, []);

  const applyResultToForm = useCallback(
    (result: AgentAnalyzeResult) => {
      const values = computeInitialFillValuesFromResult(result);
      onApply(values, result);
      try {
        for (const [fieldId] of Object.entries(values)) {
          const input = window.document.querySelector<HTMLElement>(
            `#${CSS.escape(fieldId)}`
          );
          if (input) {
            const prev = input.className;
            input.className = `${prev} agent-flash`;
            window.setTimeout(() => {
              input.className = prev;
            }, 1200);
          }
        }
        emitAutofillEvent(values, result.backend);
      } catch {
        /* noop */
      }
      setInputText("");
      setPendingFile(null);
    },
    [computeInitialFillValuesFromResult, onApply, setInputText, setPendingFile]
  );

  const fieldLabelMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    schema.forEach((field) => {
      map[field.id] = field.label;
    });
    return map;
  }, [schema]);

  const formFieldOrder = useMemo(() => schema.map((field) => field.id), [schema]);

  const groupPreviews = useMemo<GroupPreview[]>(() => {
    if (!lastResult?.fieldGroups?.length) return [];
    return lastResult.fieldGroups.map((group) => {
      const orderedEntries = formFieldOrder
        .map((fieldId) => {
          const candidate = group.fieldCandidates?.[fieldId]?.[0];
          if (!candidate?.value) return null;
          return {
            fieldId,
            label: fieldLabelMap[fieldId] ?? fieldId,
            value: candidate.value,
            confidence: candidate.confidence,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      return {
        group,
        entries: orderedEntries.slice(0, 3),
        extraCount: Math.max(0, orderedEntries.length - 3),
      };
    });
  }, [lastResult, fieldLabelMap, formFieldOrder]);

  const executeAnalysis = useCallback(
    async (docPayload: AgentDocument) => {
      updateSteps({
        prepare: { status: "done" },
        await: { status: "active" },
      });
      const result = await analyzeDocumentWithDefaultAgent(docPayload, {
        formSchema: schema,
      });
      setLastResult(result);
      updateSteps({
        await: { status: "done" },
        apply: { status: "active" },
      });
      applyResultToForm(result);
      updateSteps({
        apply: { status: "done" },
      });
      addMsg("assistant", formatAssistantSummary(result));
    },
    [schema, updateSteps, applyResultToForm, addMsg]
  );

  const beginWorkflow = useCallback(
    (mode: "file" | "text" | "retry", detail?: string) => {
      setProgressSteps(buildInitialSteps(mode, detail));
      startTimer();
    },
    [buildInitialSteps, startTimer]
  );

  const handleAnalysisError = useCallback(
    (message: string) => {
      setError(message);
      setProgressSteps((prev) =>
        prev.map((s) =>
          s.status === "active"
            ? {
                ...s,
                status: "error",
                detail: message,
              }
            : s
        )
      );
      addMsg("assistant", `出错：${message}`);
    },
    [addMsg]
  );

  const handleSubmit = useCallback(async () => {
    if (pending) return;
    const file = pendingFile;
    const text = inputText.trim();
    if (!file && !text) return;
    setPending(true);
    setError(null);
    const mode = file ? "file" : "text";
    beginWorkflow(mode, file ? undefined : "文本输入");
    try {
      addMsg("user", file ? `上传文件：${file.name}` : text);
      let docPayload: AgentDocument;
      // 解析文件 / 准备内容
      if (file) {
        const parsed = await parseFileToAgentDocument(file);
        // 更新解析步骤为完成，并激活准备请求
        updateSteps({
          parse: { status: "done", detail: parsed.formatLabel },
          prepare: { status: "active" },
        });
        docPayload = parsed.document;
      } else {
        docPayload = {
          kind: "text",
          content: text,
          filename: "input.txt",
        } as const;
      }
      lastSubmissionRef.current = {
        docPayload,
        label: file ? file.name : "文本输入",
      };
      await executeAnalysis(docPayload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "智能体处理失败";
      handleAnalysisError(msg);
    } finally {
      setPending(false);
      stopTimer();
    }
  }, [
    pending,
    inputText,
    pendingFile,
    beginWorkflow,
    updateSteps,
    executeAnalysis,
    handleAnalysisError,
    stopTimer,
    addMsg,
  ]);

  const handleRetry = useCallback(async () => {
    if (pending) return;
    const last = lastSubmissionRef.current;
    if (!last) return;
    setPending(true);
    setError(null);
    beginWorkflow("retry", last.label);
    try {
      await executeAnalysis(last.docPayload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "智能体处理失败";
      handleAnalysisError(msg);
    } finally {
      setPending(false);
      stopTimer();
    }
  }, [pending, beginWorkflow, executeAnalysis, handleAnalysisError, stopTimer]);

  const handleApplyGroupFromAssistant = useCallback(
    (group: AgentFieldGroup) => {
      if (!lastResult) return;
      const values = buildValuesFromGroup(group);
      if (!Object.keys(values).length) return;
      onApply(values, lastResult);
      addMsg(
        "assistant",
        `已使用分组「${group.label ?? group.id}」回填表单。`
      );
    },
    [lastResult, onApply, addMsg]
  );

  const buttonLabel = useMemo(() => (open ? "关闭助手" : "打开助手"), [open]);

  // 新消息滚动到底部
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // 打开时聚焦输入框
  useEffect(() => {
    if (open && stage === "open") {
      textareaRef.current?.focus();
    }
  }, [open, stage]);

  // 点击外部关闭 + ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!dialogRef.current) return;
      const target = e.target as Node;
      const toggleBtn = containerRef.current;
      if (toggleBtn && toggleBtn.contains(target)) return;
      if (!dialogRef.current.contains(target)) {
        toggle();
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") toggle();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // 粘贴文件支持
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData?.files?.length) {
      const f = e.clipboardData.files[0];
      if (f) handleSelectFile(f);
    }
  };
  // 拖拽文件支持
  const onDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) {
      const f = e.dataTransfer.files[0];
      if (f) handleSelectFile(f);
    }
    setDragActive(false);
  };
  const onDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (!dragActive) setDragActive(true);
  };
  const onDragLeave = () => setDragActive(false);
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!pending) void handleSubmit();
    }
  };

  // 自适应高度
  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useEffect(() => {
    autoGrow();
  }, [inputText, autoGrow]);

  // 校验与选择文件（类型/大小）
  const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
  // 统一通过文件解析工具导出的可接受扩展名，避免在多处维护
  const ACCEPT_EXTS_SET = useMemo(() => {
    const set = new Set<string>();
    for (const ext of ACCEPTED_FILE_EXTENSIONS) {
      const cleaned = ext.startsWith(".") ? ext.slice(1) : ext;
      set.add(cleaned.toLowerCase());
    }
    return set;
  }, []);
  const isAcceptExt = (name: string) => {
    const lower = name.toLowerCase();
    const idx = lower.lastIndexOf(".");
    if (idx === -1) return false;
    const ext = lower.slice(idx + 1);
    return ACCEPT_EXTS_SET.has(ext);
  };
  const handleSelectFile = (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setError(
        `文件过大（${(file.size / 1024 / 1024).toFixed(
          2
        )} MB），请限制在 10 MB 内。`
      );
      return;
    }
    if (!isAcceptExt(file.name)) {
      setError(
        `不支持的文件类型，请上传常见文本/办公文档（${SUPPORTED_FORMAT_LABEL}）。`
      );
      return;
    }
    setPendingFile(file);
    setError(null);
  };

  return (
    <div className="floating-assistant">
      {open && stage !== "closed"
        ? createPortal(
            <div
              className={
                "assistant-dialog " +
                (stage === "enter"
                  ? "opacity-0 translate-y-2 scale-95"
                  : stage === "exit"
                  ? "opacity-0 translate-y-1 scale-95"
                  : "opacity-100 translate-y-0 scale-100")
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
              {/* 进度条仅在处理中显示 */}
              {pending ? (
                <AssistantProgress
                  steps={progressSteps}
                  elapsedMs={elapsedMs}
                />
              ) : null}
              <div
                className="chat-messages"
                aria-live="polite"
                ref={messagesRef}
              >
                {messages.length === 0 ? (
                  <p className="subtle">在下方输入文本或上传文件开始分析。</p>
                ) : (
                  messages.map((m) => {
                    const time = new Date(m.ts).toLocaleTimeString();
                    const isUser = m.role === "user";
                    const avatar = isUser
                      ? "🧑"
                      : m.role === "assistant"
                      ? "🤖"
                      : "ℹ️";
                    return (
                      <div
                        key={m.id}
                        className={`chat-row ${
                          isUser ? "self-end flex-row-reverse" : "self-start"
                        }`}
                      >
                        <div className={`chat-line chat-line--${m.role}`}>
                          <pre>{m.content}</pre>
                        </div>
                        <div className="chat-meta">
                          <div className="chat-avatar" aria-hidden>
                            {avatar}
                          </div>
                          <span className="chat-time">{time}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {error ? (
                <p className="error mt-2">
                  {error}
                  {lastSubmissionRef.current ? (
                    <button
                      type="button"
                      className="ml-2 text-indigo-700 underline disabled:opacity-50"
                      onClick={handleRetry}
                      disabled={pending}
                    >
                      重试
                    </button>
                  ) : null}
                </p>
              ) : null}
              {groupPreviews.length ? (
                <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3">
                  <p className="text-xs text-slate-500">
                    {lastResult?.autoSelectGroupId
                      ? "已自动套用置信度最高的分组，如需调整可改用以下分组："
                      : "存在多个候选分组，请选择最合适的一组回填："}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {groupPreviews.map(({ group, entries, extraCount }) => {
                      const confidence =
                        group.confidence != null
                          ? `${Math.round(group.confidence * 100)}%`
                          : "—";
                      const isAuto = lastResult?.autoSelectGroupId === group.id;
                      return (
                        <article
                          key={group.id}
                          className="flex h-full flex-col rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] text-slate-500">分组</p>
                              <p className="text-sm font-semibold text-slate-900">
                                {group.label ?? group.id}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] text-slate-500">置信度</p>
                              <p className="text-base font-semibold text-indigo-600">
                                {confidence}
                              </p>
                            </div>
                          </div>
                          {entries.length ? (
                            <ul className="mt-2 space-y-1 text-xs text-slate-600">
                              {entries.map((entry) => (
                                <li key={`${group.id}-${entry.fieldId}`}>
                                  <span className="font-medium text-slate-800">
                                    {entry.label}
                                  </span>
                                  ：{entry.value}
                                  {entry.confidence != null ? (
                                    <span className="text-slate-400">
                                      {" "}
                                      · {Math.round((entry.confidence ?? 0) * 100)}%
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                              {extraCount > 0 ? (
                                <li className="text-slate-400">
                                  +{extraCount} 个其他字段
                                </li>
                              ) : null}
                            </ul>
                          ) : (
                            <p className="mt-2 text-xs text-slate-400">
                              暂无可展示字段
                            </p>
                          )}
                          <div className="mt-3 flex items-center justify-between gap-2 pt-2">
                            {isAuto ? (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] text-emerald-700">
                                已自动回填
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500">
                                确认后将覆盖当前表单值
                              </span>
                            )}
                            <button
                              type="button"
                              className="inline-flex items-center rounded-full border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-40"
                              onClick={() => handleApplyGroupFromAssistant(group)}
                              disabled={isAuto}
                            >
                              使用此分组
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className="chat-input">
                {pendingFile ? (
                  <div className="mb-2 text-xs text-slate-700">
                    已选择文件：<strong>{pendingFile.name}</strong>
                    <button
                      type="button"
                      className="ml-2 text-indigo-700 underline"
                      onClick={() => setPendingFile(null)}
                    >
                      移除
                    </button>
                  </div>
                ) : null}
                <div
                  className={`assistant-input-wrap ${
                    dragActive
                      ? "ring-3 ring-indigo-400/45 border-indigo-400/60"
                      : ""
                  }`}
                  aria-busy={pending}
                >
                  <button
                    type="button"
                    className="assistant-circle"
                    title="添加内容或选择文件"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={pending}
                    aria-label="添加"
                  >
                    <span className="i-material-symbols-add-rounded text-lg" />
                  </button>
                  <textarea
                    ref={textareaRef}
                    className="assistant-textarea"
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="输入你的问题，或将文件粘贴/拖拽到这里"
                    onPaste={onPaste}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onKeyDown={onKeyDown}
                    disabled={pending}
                  />
                  {dragActive ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-700 text-xs border border-indigo-400/40">
                        松开以上传文件
                      </span>
                    </div>
                  ) : null}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={ACCEPT_ATTRIBUTE_VALUE}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleSelectFile(f);
                      e.currentTarget.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className="assistant-circle assistant-circle--primary"
                    title="提交分析"
                    onClick={handleSubmit}
                    disabled={pending}
                    aria-label="发送"
                  >
                    {pending ? (
                      <span className="i-line-md:loading-twotone-loop text-white text-lg" />
                    ) : (
                      <span className="i-material-symbols-send-rounded text-white text-lg" />
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
      {createPortal(
        <button
          ref={containerRef}
          type="button"
          className={`assistant-toggle ${open ? "assistant-toggle--open" : ""}`}
          onClick={toggle}
          aria-expanded={open}
          aria-label={buttonLabel}
        >
          <span className="i-material-symbols-smart-toy-rounded text-2xl" />
        </button>,
        window.document.body
      )}
    </div>
  );
};

export default FloatingAssistant;
