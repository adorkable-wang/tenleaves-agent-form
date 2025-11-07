/**
 * RecognizedOutput
 * - 以只读方式展示识别出的字段值与候选项（便于对照）
 */
import React from 'react'
import type { AgentAnalyzeResult, AgentFieldOption, AgentFieldGroup } from '../agent'

interface Props {
  analysisResult: AgentAnalyzeResult
  formValues: Record<string, string>
  selectedGroup: AgentFieldGroup | null
  selectedGroupId: string | null
  onPickOption: (fieldId: string, option: AgentFieldOption) => void
}

export const RecognizedOutput: React.FC<Props> = ({
  analysisResult,
  formValues,
  selectedGroup,
  selectedGroupId,
  onPickOption,
}) => {
  return (
    <div className="recognized-output">
      <h3>识别字段</h3>
      <div className="recognized-grid">
        {analysisResult.fields.map((field) => {
          const groupOption = selectedGroup?.fields?.[field.fieldId]
          const activeValue =
            groupOption?.value ??
            formValues[field.fieldId] ??
            field.value ??
            field.options?.[0]?.value ??
            ''
          const displayValue = activeValue?.trim().length ? activeValue : '（未填充）'
          const displayConfidence =
            groupOption?.confidence ??
            field.options?.find((option) => option.value === activeValue)?.confidence ??
            field.confidence
          return (
            <div className="recognized-item" key={field.fieldId}>
              <span className="recognized-label">{field.label}</span>
              <span className="recognized-value">{displayValue}</span>
              <span className="recognized-confidence">
                置信度：
                {Number.isFinite(displayConfidence)
                  ? `${Math.round((displayConfidence as number) * 100)}%`
                  : '--'}
              </span>
              {field.options?.length ? (
                <div className="recognized-options">
                  {field.options.map((option) => {
                    const isActive = selectedGroupId
                      ? option.groupId === selectedGroupId
                      : activeValue === option.value
                    return (
                      <button
                        type="button"
                        key={`${field.fieldId}-${option.groupId ?? 'field'}-${option.value}`}
                        className={`option-pill${isActive ? ' option-pill--active' : ''}`}
                        onClick={() => onPickOption(field.fieldId, option)}
                      >
                        {option.value}
                        {option.confidence !== undefined
                          ? ` · ${Math.round(option.confidence * 100)}%`
                          : ''}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {Object.keys(analysisResult.extractedPairs).length ? (
        <details className="extracted-pairs">
          <summary>查看原始键值对</summary>
          <ul>
            {Object.entries(analysisResult.extractedPairs).map(([key, value]) => (
              <li key={key}>
                <strong>{key}：</strong>
                <span>{value}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

export default RecognizedOutput
