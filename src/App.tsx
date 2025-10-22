import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  analyzeDocumentWithDefaultAgent,
  type AgentAction,
  type AgentAnalyzeResult,
  type AgentFieldGroup,
  type AgentFieldOption,
  type AgentFormField,
} from "./agent";
import {
  ACCEPT_ATTRIBUTE_VALUE,
  parseFileToAgentDocument,
  SUPPORTED_FORMAT_LABEL,
  UnsupportedFileError,
  EmptyFileError,
} from "./utils/fileParser";
import "./App.css";

type AgentStatus = "idle" | "loading" | "error" | "success";

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "空闲",
  loading: "分析中",
  error: "出错",
  success: "已完成",
};

const formSchema: AgentFormField[] = [
  {
    id: "fullName",
    label: "姓名",
    synonyms: [
      "name",
      "full name",
      "applicant name",
      "contact name",
      "姓名",
      "全名",
    ],
    description: "申请人的中文或英文全名。",
  },
  {
    id: "email",
    label: "邮箱地址",
    synonyms: ["email", "mail", "e-mail", "电子邮箱", "邮箱地址"],
    description: "主要的联系邮箱。",
  },
  {
    id: "phone",
    label: "联系电话",
    synonyms: [
      "mobile",
      "telephone",
      "phone number",
      "contact number",
      "电话",
      "联系电话",
      "手机号",
    ],
    description: "方便联系的电话号码，若能提供区号更好。",
  },
  {
    id: "company",
    label: "所在公司",
    synonyms: [
      "organization",
      "employer",
      "company name",
      "company",
      "公司",
      "所在公司",
      "机构",
    ],
    description: "文档中提到的公司或机构名称。",
  },
  {
    id: "role",
    label: "职位 / 头衔",
    synonyms: ["job title", "position", "role", "职位", "头衔", "岗位"],
    description: "当前担任或目标申请的职位。",
  },
  {
    id: "summary",
    label: "个人摘要",
    synonyms: [
      "profile summary",
      "bio",
      "overview",
      "summary",
      "个人简介",
      "概要",
    ],
    description: "结合文档信息生成的简介或亮点描述。",
  },
];

const createInitialFormValues = () =>
  formSchema.reduce<Record<string, string>>((acc, field) => {
    acc[field.id] = "";
    return acc;
  }, {});

function App() {
  const [formValues, setFormValues] = useState<Record<string, string>>(() =>
    createInitialFormValues()
  );
  const [analysisResult, setAnalysisResult] =
    useState<AgentAnalyzeResult | null>(null);
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [parsedFormat, setParsedFormat] = useState<string>("");
  const [parsingNotes, setParsingNotes] = useState<string[]>([]);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisRemainingMs, setAnalysisRemainingMs] = useState<number | null>(
    null
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const analysisStartRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);

  const completionRatio = useMemo(() => {
    if (!analysisResult) return "0 / 0";
    const total = analysisResult.fields.length;
    const filled = analysisResult.fields.filter((field) => field.value).length;
    return `${filled} / ${total}`;
  }, [analysisResult]);

  const formattedETA = useMemo(
    () => formatRemaining(analysisRemainingMs),
    [analysisRemainingMs]
  );

  const fieldOptionsMap = useMemo<Record<string, AgentFieldOption[]>>(() => {
    if (!analysisResult) return {};
    const map: Record<string, AgentFieldOption[]> = {};
    for (const field of analysisResult.fields) {
      if (field.options?.length) {
        map[field.fieldId] = field.options;
      }
    }
    for (const group of analysisResult.fieldGroups ?? []) {
      Object.entries(group.fields).forEach(([fieldId, option]) => {
        if (!map[fieldId]) {
          map[fieldId] = [];
        }
        if (
          !map[fieldId].some(
            (existing) =>
              existing.value === option.value &&
              existing.groupId === option.groupId
          )
        ) {
          map[fieldId].push(option);
        }
      });
    }
    return map;
  }, [analysisResult]);

  const selectedGroup = useMemo(() => {
    if (!analysisResult?.fieldGroups?.length || !selectedGroupId) {
      return null;
    }
    return (
      analysisResult.fieldGroups.find((group) => group.id === selectedGroupId) ??
      null
    );
  }, [analysisResult, selectedGroupId]);

  const loadingAriaText = useMemo(() => {
    if (status !== "loading") return undefined;
    return `正在分析文档，进度 ${analysisProgress}%，预计剩余 ${formattedETA}`;
  }, [status, analysisProgress, formattedETA]);

  useEffect(() => {
    const ESTIMATED_ANALYSIS_MS = 16000;

    if (status === "loading") {
      analysisStartRef.current = performance.now();
      setAnalysisProgress(5);
      setAnalysisRemainingMs(ESTIMATED_ANALYSIS_MS);

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }

      progressTimerRef.current = window.setInterval(() => {
        if (!analysisStartRef.current) return;
        const elapsed = performance.now() - analysisStartRef.current;
        const ratio = Math.min(elapsed / ESTIMATED_ANALYSIS_MS, 0.95);
        setAnalysisProgress(() =>
          Math.max(5, Math.round(Math.min(ratio, 0.95) * 100))
        );
        setAnalysisRemainingMs(Math.max(ESTIMATED_ANALYSIS_MS - elapsed, 0));
      }, 250);

      return () => {
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
      };
    }

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    analysisStartRef.current = null;

    if (status === "success") {
      setAnalysisProgress(100);
      setAnalysisRemainingMs(0);
    } else {
      setAnalysisProgress(0);
      setAnalysisRemainingMs(null);
    }
  }, [status]);

  useEffect(() => {
    if (!analysisResult) return;

    const printableFields = analysisResult.fields.map((field) => ({
      字段编号: field.fieldId,
      标签: field.label,
      识别值: field.value ?? "",
      置信度: `${Math.round(field.confidence * 100)}%`,
    }));

    console.groupCollapsed(
      `%c智能体识别结果 - ${analysisResult.backend}`,
      "color:#2563eb;font-weight:600;"
    );
    console.table(printableFields);

    const hasPairs = Object.keys(analysisResult.extractedPairs).length > 0;
    if (hasPairs) {
      console.groupCollapsed("原始键值对");
      console.table(analysisResult.extractedPairs);
      console.groupEnd();
    }

    if (analysisResult.summary) {
      console.info("摘要：", analysisResult.summary);
    }

    if (analysisResult.diagnostics?.length) {
      console.warn("诊断信息：", analysisResult.diagnostics);
    }

    if (parsingNotes.length) {
      console.info("解析提示：", parsingNotes);
    }

    console.groupEnd();
  }, [analysisResult, parsingNotes]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setSelectedFile(file.name);
      setError(null);
      setAnalysisResult(null);
      setParsedFormat("");
      setParsingNotes([]);

      setStatus("loading");

      try {
        const parsed = await parseFileToAgentDocument(file);
        setParsedFormat(parsed.formatLabel);
        setParsingNotes(parsed.notes);

        const rawResult = await analyzeDocumentWithDefaultAgent(
          parsed.document,
          {
            formSchema,
          }
        );

        console.log(rawResult);
        if (!Array.isArray(rawResult.fields)) {
          throw new Error("智能体返回的字段格式无效，请稍后重试。");
        }

        const result = {
          ...rawResult,
          fields: rawResult.fields.filter(
            (item) => !!item && typeof item === "object"
          ),
        };

        const primaryGroup = result.fieldGroups?.length
          ? [...result.fieldGroups].sort(
              (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)
            )[0]
          : null;

        const recognizedCount = result.fields.filter((field) => {
          const primaryValue =
            field.value?.trim().length ? field.value : undefined;
          const optionValue = field.options?.some(
            (option) => option.value && option.value.trim().length
          );
          return Boolean(primaryValue || optionValue);
        }).length;

        const groupRecognized =
          result.fieldGroups?.some((group) =>
            Object.values(group.fields).some(
              (option) => option.value && option.value.trim().length
            )
          ) ?? false;

        setAnalysisResult(result);
        setFormValues(() => {
          const base = createInitialFormValues();
          if (primaryGroup) {
            Object.entries(primaryGroup.fields).forEach(([fieldId, option]) => {
              if (option.value) {
                base[fieldId] = option.value;
              }
            });
          }
          for (const field of result.fields ?? []) {
            const primaryValue = field.value ?? field.options?.[0]?.value;
            if (primaryValue && !base[field.fieldId]) {
              base[field.fieldId] = primaryValue;
            }
          }
          return base;
        });
        setSelectedGroupId(primaryGroup?.id ?? null);
        if (recognizedCount === 0 && !groupRecognized) {
          setError(
            `未能识别出可填充的字段。请确认文档包含清晰的字段说明。当前支持的格式：${SUPPORTED_FORMAT_LABEL}。`
          );
        } else {
          setError(null);
        }
        setStatus("success");
      } catch (cause) {
        if (
          cause instanceof UnsupportedFileError ||
          cause instanceof EmptyFileError
        ) {
          setError(cause.message);
        } else if (cause instanceof Error) {
          setError(cause.message || "智能体处理文件失败。");
        } else {
          setError("智能体处理文件失败。");
        }
        setStatus("error");
        setAnalysisResult(null);
        setFormValues(createInitialFormValues());
        setSelectedGroupId(null);
      } finally {
        // Reset input so the same file can trigger the change event again.
        event.target.value = "";
      }
    },
    []
  );

  const handleInputChange = useCallback(
    (fieldId: string) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        setFormValues((prev) => ({
          ...prev,
          [fieldId]: value,
        }));
      },
    []
  );

  const resetForm = useCallback(() => {
    setFormValues(createInitialFormValues());
    setAnalysisResult(null);
    setStatus("idle");
    setSelectedFile("");
    setError(null);
    setParsedFormat("");
    setParsingNotes([]);
    setAnalysisProgress(0);
    setAnalysisRemainingMs(null);
  }, []);

  const applyGroup = useCallback((group: AgentFieldGroup) => {
    setSelectedGroupId(group.id);
    setError(null);
    setFormValues((prev) => {
      const next = { ...prev };
      Object.entries(group.fields).forEach(([fieldId, option]) => {
        next[fieldId] = option.value ?? "";
      });
      return next;
    });
  }, []);

  const applySuggestion = useCallback(
    (fieldId: string, option: AgentFieldOption) => {
      if (option.groupId && analysisResult?.fieldGroups) {
        const group = analysisResult.fieldGroups.find(
          (item) => item.id === option.groupId
        );
        if (group) {
          applyGroup(group);
          return;
        }
      }
      setSelectedGroupId(null);
      setFormValues((prev) => ({
        ...prev,
        [fieldId]: option.value,
      }));
    },
    [analysisResult, applyGroup]
  );

  const handleActionClick = useCallback((action: AgentAction) => {
    console.log("执行动作", action);
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>文档智能填表</h1>
          <p>
            上传结构化文本、Markdown 或 JSON
            文件，智能体会分析内容并给出表单填充建议，你可以在此基础上再次编辑。
          </p>
          <p className="support-hint">
            支持格式：{SUPPORTED_FORMAT_LABEL}。若文件无法识别，将提示手动处理。
          </p>
        </div>
        <div className="header__actions">
          <label className="file-input">
            <span>选择文档</span>
            <input
              type="file"
              accept={ACCEPT_ATTRIBUTE_VALUE}
              onChange={handleFileChange}
              disabled={status === "loading"}
            />
          </label>
          <button
            type="button"
            className="ghost-button"
            onClick={resetForm}
            disabled={status === "loading" && !analysisResult}
          >
            重置
          </button>
        </div>
      </header>

      <main className="app__content">
        <section className="analysis-panel">
          <h2>智能体状态</h2>
          <div className="analysis-panel__status">
            <span className={`status status--${status}`}>
              {STATUS_LABELS[status]}
            </span>
            {selectedFile ? (
              <span>{selectedFile}</span>
            ) : (
              <span>尚未选择文件</span>
            )}
            {parsedFormat ? (
              <span className="status-format">识别格式：{parsedFormat}</span>
            ) : null}
            {analysisResult ? (
              <span>已自动填充 {completionRatio} 个字段</span>
            ) : (
              <span>等待文件分析…</span>
            )}
          </div>
          {status === "loading" ? (
            <>
              <div
                className="progress-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={analysisProgress}
                aria-valuetext={loadingAriaText}
              >
                <div
                  className="progress-bar__indicator"
                  style={{
                    width: `${Math.min(Math.max(analysisProgress, 5), 100)}%`,
                  }}
                />
              </div>
              <div className="progress-meta">
                <span>{analysisProgress}%</span>
                <span>预计剩余：{formattedETA}</span>
              </div>
            </>
          ) : null}

          {error && <p className="error">{error}</p>}

          {(analysisResult || parsingNotes.length) && (
            <div className="analysis-details">
              {parsingNotes.length ? (
                <ul className="parser-notes">
                  {parsingNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
              {analysisResult ? (
                <>
                  <p>
                    <strong>后端：</strong> {analysisResult.backend}
                  </p>
                  {analysisResult.summary && (
                    <p>
                      <strong>摘要：</strong> {analysisResult.summary}
                    </p>
                  )}
                  {analysisResult.diagnostics?.length ? (
                    <ul className="diagnostics">
                      {analysisResult.diagnostics.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="subtle">暂无诊断信息。</p>
                  )}
                  {analysisResult.actions?.length ? (
                    <div className="action-panel">
                      <h4>建议操作</h4>
                      <ul>
                        {analysisResult.actions.map((action, index) => (
                          <li key={`${action.type}-${index}`}>
                            <button
                              type="button"
                              className="action-pill"
                              onClick={() => handleActionClick(action)}
                            >
                              {action.type}
                              {action.target ? ` → ${action.target}` : ""}
                              {action.confidence !== undefined
                                ? ` · ${Math.round(action.confidence * 100)}%`
                                : ""}
                            </button>
                            {action.rationale ? (
                              <p className="action-rationale">{action.rationale}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {analysisResult.fieldGroups?.length ? (
                    <div className="group-selector">
                      <h4>识别的候选组合</h4>
                      <div className="group-selector__pills">
                        {analysisResult.fieldGroups.map((group, index) => {
                          const label = group.label ?? `组合 ${index + 1}`;
                          const isActive = selectedGroupId === group.id;
                          return (
                            <button
                              type="button"
                              key={group.id}
                              className={`group-pill${
                                isActive ? " group-pill--active" : ""
                              }`}
                              onClick={() => applyGroup(group)}
                            >
                              {label}
                              {group.confidence !== undefined
                                ? ` · ${Math.round(group.confidence * 100)}%`
                                : ""}
                            </button>
                          );
                        })}
                      </div>
                      {selectedGroup?.rationale ? (
                        <p className="group-hint">{selectedGroup.rationale}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="recognized-output">
                    <h3>识别字段</h3>
                    <div className="recognized-grid">
                      {analysisResult.fields.map((field) => {
                        const groupOption = selectedGroup?.fields?.[field.fieldId];
                        const activeValue =
                          groupOption?.value ??
                          formValues[field.fieldId] ??
                          field.value ??
                          field.options?.[0]?.value ??
                          "";
                        const displayValue = activeValue?.trim().length
                          ? activeValue
                          : "（未填充）";
                        const displayConfidence =
                          groupOption?.confidence ??
                          field.options?.find(
                            (option) => option.value === activeValue
                          )?.confidence ??
                          field.confidence;
                        return (
                          <div className="recognized-item" key={field.fieldId}>
                            <span className="recognized-label">
                              {field.label}
                            </span>
                            <span className="recognized-value">{displayValue}</span>
                            <span className="recognized-confidence">
                              置信度：
                              {Number.isFinite(displayConfidence)
                                ? `${Math.round(displayConfidence * 100)}%`
                                : "--"}
                            </span>
                            {field.options?.length ? (
                              <div className="recognized-options">
                                {field.options.map((option) => {
                                  const isActive = selectedGroupId
                                    ? option.groupId === selectedGroupId
                                    : activeValue === option.value;
                                  return (
                                    <button
                                      type="button"
                                      key={`${field.fieldId}-${option.groupId ?? "field"}-${option.value}`}
                                      className={`option-pill${
                                        isActive ? " option-pill--active" : ""
                                      }`}
                                      onClick={() =>
                                        applySuggestion(field.fieldId, option)
                                      }
                                    >
                                      {option.value}
                                      {option.confidence !== undefined
                                        ? ` · ${Math.round(option.confidence * 100)}%`
                                        : ""}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    {Object.keys(analysisResult.extractedPairs).length ? (
                      <details className="extracted-pairs">
                        <summary>查看原始键值对</summary>
                        <ul>
                          {Object.entries(analysisResult.extractedPairs).map(
                            ([key, value]) => (
                              <li key={key}>
                                <strong>{key}：</strong>
                                <span>{value}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </section>

        <section className="form-panel">
          <h2>表单审核与编辑</h2>
          <form className="autofill-form">
            {formSchema.map((field) => {
              const value = formValues[field.id] ?? "";
              const isTextarea = field.id === "summary";
              const suggestions = fieldOptionsMap[field.id];
              const inputProps = {
                id: field.id,
                name: field.id,
                value,
                onChange: handleInputChange(field.id),
                placeholder: field.description,
                disabled: status === "loading",
              };

              return (
                <div className="form-field" key={field.id}>
                  <label htmlFor={field.id}>{field.label}</label>
                  {isTextarea ? (
                    <textarea rows={4} {...inputProps} />
                  ) : (
                    <input type="text" {...inputProps} />
                  )}
                  {suggestions?.length ? (
                    <div className="field-suggestions">
                      {suggestions.map((option) => {
                        const isActive = selectedGroupId
                          ? option.groupId === selectedGroupId
                          : value === option.value;
                        return (
                          <button
                            type="button"
                            key={`${field.id}-option-${option.groupId ?? "field"}-${option.value}`}
                            className={`option-pill${
                              isActive ? " option-pill--active" : ""
                            }`}
                            onClick={() => applySuggestion(field.id, option)}
                          >
                            {option.value}
                            {option.confidence !== undefined
                              ? ` · ${Math.round(option.confidence * 100)}%`
                              : ""}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {field.description && (
                    <span className="field-hint">{field.description}</span>
                  )}
                </div>
              );
            })}
          </form>
        </section>
      </main>
    </div>
  );
}

export default App;

function formatRemaining(ms: number | null): string {
  if (ms === null) return "计算中…";
  const seconds = Math.ceil(ms / 1000);
  if (seconds <= 0) return "即将完成";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return remainingSeconds
      ? `${minutes}分${remainingSeconds}秒`
      : `${minutes}分钟`;
  }
  return `${seconds}秒`;
}
