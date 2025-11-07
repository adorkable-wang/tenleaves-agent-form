/**
 * AutofillForm
 * - 可编辑的表单区域：展示 schema 字段，并允许选择候选/手动修改
 */
import React from 'react'
import type { AgentFieldOption, AgentFormField } from '../agent'

interface Props {
  schema: AgentFormField[]
  values: Record<string, string>
  suggestions: Record<string, AgentFieldOption[]>
  disabled?: boolean
  onChange: (fieldId: string, value: string) => void
}

export const AutofillForm: React.FC<Props> = ({
  schema,
  values,
  suggestions,
  disabled,
  onChange,
}) => {
  return (
    <form className="autofill-form">
      {schema.map((field) => {
        const value = values[field.id] ?? ''
        const isTextarea = field.id === 'summary'
        const inputProps = {
          id: field.id,
          name: field.id,
          value,
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            onChange(field.id, e.target.value),
          placeholder: field.description,
          disabled,
        }
        const options = suggestions[field.id] ?? []
        return (
          <div className="form-field" key={field.id}>
            <label htmlFor={field.id}>{field.label}</label>
            {isTextarea ? (
              <textarea rows={4} {...inputProps} />
            ) : (
              <input type="text" {...(inputProps as React.InputHTMLAttributes<HTMLInputElement>)} />
            )}
            {options.length ? (
              <div className="field-suggestions">
                {options.map((opt) => {
                  const isActive = value === opt.value
                  return (
                    <button
                      type="button"
                      key={`${field.id}-option-${opt.groupId ?? 'field'}-${opt.value}`}
                      className={`option-pill${isActive ? ' option-pill--active' : ''}`}
                      onClick={() => onChange(field.id, opt.value)}
                    >
                      {opt.value}
                      {opt.confidence !== undefined
                        ? ` · ${Math.round(opt.confidence * 100)}%`
                        : ''}
                    </button>
                  )
                })}
              </div>
            ) : null}
            {field.description && <span className="field-hint">{field.description}</span>}
          </div>
        )
      })}
    </form>
  )
}

export default AutofillForm
