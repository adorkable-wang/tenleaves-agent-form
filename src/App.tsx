/**
 * 应用主界面（中文注释版）
 *
 * 功能概览：
 * - 页面主体：仅展示可编辑的表单（AutofillForm），候选值在表单项中以“选项胶囊”呈现
 * - 右下角悬浮助手（FloatingAssistant）：支持文本/文件输入，提交后调用智能体并回填表单
 * - 首次获得分析结果时，自动应用“最高置信度组合 + 字段主值/候选首值”初始化表单
 */
import { useCallback, useMemo, useState } from 'react'
import { type AgentAnalyzeResult, type AgentFieldOption } from './agent'
// 悬浮窗聊天助手
import FloatingAssistant from './components/FloatingAssistant'
import AutofillForm from './components/AutofillForm'
import { SUPPORTED_FORMAT_LABEL } from './utils/fileParser'
import { formSchema } from './schema/formSchema'
// 样式由 UnoCSS shortcuts 提供

// 表单字段定义已抽出至 ./schema/formSchema

// 初始化表单值的工具函数
import { createInitialFormValues } from './schema/utils'

function App() {
  const [formValues, setFormValues] = useState<Record<string, string>>(() =>
    createInitialFormValues(formSchema)
  )
  const [analysisResult, setAnalysisResult] = useState<AgentAnalyzeResult | null>(null)
  // 保留文件名状态以备扩展，当前未使用
  // 已不使用 useAgentAnalysis，悬浮助手内部独立管理上传/分析

  // 页面主区域仅展示表单，由悬浮助手触发分析与填充

  // 将智能体输出的字段候选项合并成映射：fieldId -> options[]（包含组内选项）
  const fieldOptionsMap = useMemo<Record<string, AgentFieldOption[]>>(() => {
    if (!analysisResult) return {}
    const map: Record<string, AgentFieldOption[]> = {}
    for (const group of analysisResult.fieldGroups ?? []) {
      const candidates = group.fieldCandidates
      Object.entries(candidates).forEach(([fieldId, options]) => {
        if (!options?.length) return
        if (!map[fieldId]) map[fieldId] = []
        for (const option of options) {
          if (
            !map[fieldId].some(
              (existing) => existing.value === option.value && existing.groupId === option.groupId
            )
          ) {
            map[fieldId].push(option)
          }
        }
      })
    }
    Object.values(map).forEach((options) =>
      options.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    )
    return map
  }, [analysisResult])

  // 无需镜像 Hook 结果；悬浮窗 onApply 会直接写入

  // 输入变更逻辑已由 AutofillForm 组件通过 onChange 直接处理

  // 重置表单并清理状态
  const resetForm = useCallback(() => {
    setFormValues(createInitialFormValues(formSchema))
    setAnalysisResult(null)
  }, [])

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
  )
}

export default App
