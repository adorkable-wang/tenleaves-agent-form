/**
 * 悬浮聊天助手（中文注释版）
 * - 固定右下角的按钮（Portal 到 body，不受父容器影响）
 * - 打开对话框（也 Portal 到 body），支持外部点击/ESC 关闭
 * - 单输入框：文本输入 + 粘贴文件 + 拖拽文件 + 点击“＋”选择文件
 * - 提交后调用智能体 → 输出消息 → 回填表单并高亮 → 派发事件
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AgentAnalyzeResult, AgentFormField } from "../agent";
import {
  analyzeDocumentWithDefaultAgent,
  type AgentFieldGroup,
} from "../agent";
import { parseFileToAgentDocument } from "../utils/fileParser";

// 聊天消息结构（包含时间戳，便于显示发送时间）
type ChatMsg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
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

  const addMsg = (role: ChatMsg["role"], content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()) + Math.random(), role, content, ts: Date.now() },
    ]);
  };

  const computeFillValues = useCallback(
    (result: AgentAnalyzeResult): Record<string, string> => {
      const values: Record<string, string> = {};
      const primaryGroup: AgentFieldGroup | null = result.fieldGroups?.length
        ? [...result.fieldGroups].sort(
            (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)
          )[0]
        : null;
      if (primaryGroup) {
        Object.entries(primaryGroup.fields).forEach(([fieldId, option]) => {
          if (option.value) values[fieldId] = option.value;
        });
      }
      for (const field of result.fields) {
        const v = field.value ?? field.options?.[0]?.value;
        if (v && !values[field.fieldId]) values[field.fieldId] = v;
      }
      return values;
    },
    []
  );

  const formatAssistantSummary = (result: AgentAnalyzeResult): string => {
    const lines: string[] = [];
    if (result.summary) lines.push(`摘要：${result.summary}`);
    lines.push("识别字段：");
    for (const f of result.fields) {
      const v = f.value ?? f.options?.[0]?.value ?? "";
      const conf = Math.round((f.confidence ?? 0) * 100);
      lines.push(`- ${f.label}: ${v || "（空）"}（置信度 ${conf}%）`);
    }
    return lines.join("\n");
  };

  const handleSubmit = useCallback(async () => {
    const file = pendingFile;
    const text = inputText.trim();
    if (!file && !text) return;
    setPending(true);
    setError(null);
    try {
      addMsg("user", file ? `上传文件：${file.name}` : text);

      const docPayload = file
        ? (await parseFileToAgentDocument(file)).document
        : ({ kind: "text", content: text, filename: "input.txt" } as const);

      const result = await analyzeDocumentWithDefaultAgent(docPayload, {
        formSchema: schema,
      });
      const values = computeFillValues(result);
      onApply(values, result);
      // 表单联动：高亮已填充的表单字段，并派发自定义事件
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
        window.document.dispatchEvent(
          new CustomEvent("agent:autofill", {
            detail: { values, backend: result.backend },
          })
        );
      } catch {
        /* empty */
      }

      addMsg("assistant", formatAssistantSummary(result));
      setInputText("");
      setPendingFile(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "智能体处理失败";
      setError(msg);
      addMsg("assistant", `出错：${msg}`);
    } finally {
      setPending(false);
    }
  }, [inputText, schema, computeFillValues, onApply, pendingFile]);

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
  const ACCEPT_EXTS = [
    "txt",
    "text",
    "md",
    "markdown",
    "json",
    "csv",
    "tsv",
    "yaml",
    "yml",
    "docx",
    "xlsx",
    "xls",
    "xlsm",
    "xlsb",
    "ods",
  ];
  const isAcceptExt = (name: string) => {
    const lower = name.toLowerCase();
    const idx = lower.lastIndexOf(".");
    if (idx === -1) return false;
    const ext = lower.slice(idx + 1);
    return ACCEPT_EXTS.includes(ext);
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
        "不支持的文件类型，请上传常见文本/办公文档（TXT/MD/JSON/CSV/YAML/DOCX/XLSX 等）。"
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
              {error ? <p className="error mt-2">{error}</p> : null}
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
  );
};

export default FloatingAssistant;
