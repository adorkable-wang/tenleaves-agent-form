/**
 * 应用主界面（中文注释版）
 *
 * 功能概览：
 * - 页面主体：仅展示可编辑的表单（AutofillForm），候选值在表单项中以“选项胶囊”呈现
 * - 右下角悬浮助手（FloatingAssistant）：支持文本/文件输入，提交后调用智能体并回填表单
 * - 首次获得分析结果时，自动应用“最高置信度组合 + 字段主值/候选首值”初始化表单
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AgentAnalyzeResult,
  type AgentFieldGroup,
  type AgentFieldOption,
} from "./agent";
import { buildValuesFromGroup, chooseInitialValuesFromResult } from './agent/utils'
// 悬浮窗聊天助手
import FloatingAssistant from "./components/FloatingAssistant";
import AutofillForm from "./components/AutofillForm";
import { SUPPORTED_FORMAT_LABEL } from "./utils/fileParser";
import { formSchema } from "./schema/formSchema";
// 样式由 UnoCSS shortcuts 提供

// 表单字段定义已抽出至 ./schema/formSchema

// 初始化表单值的工具函数
import { createInitialFormValues } from './schema/utils'

type GroupPreview = {
  group: AgentFieldGroup
  entries: Array<{
    fieldId: string
    label: string
    value: string
    confidence?: number
  }>
  extraCount: number
}

function App() {
  const [formValues, setFormValues] = useState<Record<string, string>>(() =>
    createInitialFormValues(formSchema)
  );
  const [analysisResult, setAnalysisResult] = useState<AgentAnalyzeResult | null>(null);
  // 保留文件名状态以备扩展，当前未使用
  // 已不使用 useAgentAnalysis，悬浮助手内部独立管理上传/分析

  // 页面主区域仅展示表单，由悬浮助手触发分析与填充

  const fieldLabelMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    formSchema.forEach((field) => {
      map[field.id] = field.label
    })
    return map
  }, [])

  const formFieldOrder = useMemo(() => formSchema.map((field) => field.id), [])

  // 将智能体输出的字段候选项合并成映射：fieldId -> options[]（包含组内选项）
  const fieldOptionsMap = useMemo<Record<string, AgentFieldOption[]>>(() => {
    if (!analysisResult) return {};
    const map: Record<string, AgentFieldOption[]> = {};
    for (const group of analysisResult.fieldGroups ?? []) {
      const candidates = group.fieldCandidates;
      Object.entries(candidates).forEach(([fieldId, options]) => {
        if (!options?.length) return;
        if (!map[fieldId]) map[fieldId] = [];
        for (const option of options) {
          if (
            !map[fieldId].some(
              (existing) =>
                existing.value === option.value &&
                existing.groupId === option.groupId
            )
          ) {
            map[fieldId].push(option);
          }
        }
      });
    }
    Object.values(map).forEach((options) =>
      options.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    );
    return map;
  }, [analysisResult]);

  const groupPreviews = useMemo<GroupPreview[]>(() => {
    if (!analysisResult?.fieldGroups?.length) return []
    return analysisResult.fieldGroups.map((group) => {
      const orderedEntries = formFieldOrder
        .map((fieldId) => {
          const candidate = group.fieldCandidates?.[fieldId]?.[0]
          if (!candidate?.value) return null
          return {
            fieldId,
            label: fieldLabelMap[fieldId] ?? fieldId,
            value: candidate.value,
            confidence: candidate.confidence,
          }
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
      return {
        group,
        entries: orderedEntries.slice(0, 3),
        extraCount: Math.max(0, orderedEntries.length - 3),
      }
    })
  }, [analysisResult, fieldLabelMap, formFieldOrder])

  const handleApplyGroup = useCallback(
    (group: AgentFieldGroup) => {
      const values = buildValuesFromGroup(group)
      if (!Object.keys(values).length) return
      setFormValues((prev) => ({ ...prev, ...values }))
    },
    [setFormValues]
  )

  // 无需镜像 Hook 结果；悬浮窗 onApply 会直接写入

  // 控制台打印识别详情（便于开发调试）
  useEffect(() => {
    if (!analysisResult) return;
    if (!import.meta.env.DEV) return;

    console.groupCollapsed(
      `%c智能体识别结果 - ${analysisResult.backend}`,
      "color:#2563eb;font-weight:600;"
    );
      const printableGroups = (analysisResult.fieldGroups ?? []).map((group) => ({
        分组: group.id,
        置信度: group.confidence != null ? `${Math.round(group.confidence * 100)}%` : "—",
        字段数: Object.keys(group.fieldCandidates).length,
      }));
    console.table(printableGroups);

      const firstGroup = analysisResult.fieldGroups?.[0];
      if (firstGroup?.fieldCandidates) {
        const preview = Object.entries(firstGroup.fieldCandidates).map(
          ([fieldId, opts]) => ({
            字段: fieldId,
            首选值: opts?.[0]?.value ?? "",
            首选置信度:
              opts?.[0]?.confidence != null
                ? `${Math.round((opts[0].confidence ?? 0) * 100)}%`
                : "—",
          })
        );
      console.groupCollapsed("第一分组字段预览");
      console.table(preview);
      console.groupEnd();
    }

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

    console.groupEnd();
  }, [analysisResult]);

  // 输入变更逻辑已由 AutofillForm 组件通过 onChange 直接处理

  // 当新的分析结果可用时初始化表单值（每份结果仅初始化一次，防止循环）
  const lastInitializedRef = useRef<AgentAnalyzeResult | null>(null)
  useEffect(() => {
    if (!analysisResult) return
    // 若本次结果已初始化过，直接退出
    if (lastInitializedRef.current === analysisResult) return

    // 仅当表单当前全部为空时才进行初始化，避免覆盖用户已编辑内容
    const allEmpty = Object.values(formValues).every((v) => !v)
    if (!allEmpty) return

    setFormValues((prev) => ({ ...prev, ...chooseInitialValuesFromResult(analysisResult) }))
    // 记录已对该份结果做过初始化
    lastInitializedRef.current = analysisResult
    // 仅依赖 analysisResult（避免 setFormValues -> formValues 变化导致的重复触发）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisResult])

  // 重置表单并清理状态
  const resetForm = useCallback(() => {
    setFormValues(createInitialFormValues(formSchema));
    setAnalysisResult(null);
  }, []);

  // 由悬浮窗直接回填表单，无需字段候选/动作面板点击

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>文档智能填表</h1>
          <p className="support-hint">支持：{SUPPORTED_FORMAT_LABEL}</p>
        </div>
        <div className="header__actions">
          <button type="button" className="ghost-button" onClick={resetForm}>
            重置表单
          </button>
        </div>
      </header>

      <main className="app__content">
        {groupPreviews.length ? (
          <section className="group-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2>分组候选</h2>
                <p className="text-sm text-slate-500">
                  {analysisResult?.autoSelectGroupId
                    ? "已自动回填置信度最高的分组，仍可切换其它分组选项。"
                    : "当存在多个候选分组时，请选择最贴合的分组并一键回填。"}
                </p>
              </div>
              <span className="text-xs text-slate-500">
                共 {groupPreviews.length} 组
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {groupPreviews.map(({ group, entries, extraCount }) => {
                const confidence =
                  group.confidence != null
                    ? `${Math.round(group.confidence * 100)}%`
                    : "—"
                const isAuto = analysisResult?.autoSelectGroupId === group.id
                return (
                  <article
                    key={group.id}
                    className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500">分组</p>
                        <p className="text-base font-semibold text-slate-900">
                          {group.label ?? group.id}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">置信度</p>
                        <p className="text-lg font-semibold text-indigo-600">
                          {confidence}
                        </p>
                      </div>
                    </div>

                    {entries.length ? (
                      <ul className="mt-3 space-y-1 text-sm text-slate-600">
                        {entries.map((entry) => (
                          <li key={`${group.id}-${entry.fieldId}`}>
                            <span className="font-medium text-slate-800">
                              {entry.label}
                            </span>
                            ：{entry.value}
                            {entry.confidence != null ? (
                              <span className="text-xs text-slate-400">
                                {" "}
                                · {Math.round((entry.confidence ?? 0) * 100)}%
                              </span>
                            ) : null}
                          </li>
                        ))}
                        {extraCount > 0 ? (
                          <li className="text-xs text-slate-400">
                            +{extraCount} 个其他字段
                          </li>
                        ) : null}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">
                        暂无可展示字段
                      </p>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-2">
                      {isAuto ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                          已自动回填
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">
                          确认后将覆盖当前表单值
                        </span>
                      )}
                      <button
                        type="button"
                        className="ghost-button border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                        onClick={() => handleApplyGroup(group)}
                        disabled={isAuto}
                      >
                        使用此分组回填
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        <section className="form-panel">
          <h2>表单审核与编辑</h2>
          <AutofillForm
            schema={formSchema}
            values={formValues}
            suggestions={fieldOptionsMap}
            disabled={false}
            onChange={(fieldId, value) => setFormValues((prev) => ({ ...prev, [fieldId]: value }))}
          />
        </section>
      </main>

      <FloatingAssistant
        schema={formSchema}
        onApply={(values, result) => {
          setAnalysisResult(result)
          setFormValues((prev) => ({ ...prev, ...values }))
        }}
      />
    </div>
  );
}

export default App;
