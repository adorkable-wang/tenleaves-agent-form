import React from 'react'
import type { AgentAction } from '../agent'

interface Props {
  actions: AgentAction[]
  onTrigger: (action: AgentAction) => void
}

export const ActionPanel: React.FC<Props> = ({ actions, onTrigger }) => {
  if (!actions.length) return null
  return (
    <div className="action-panel">
      <h4>建议操作</h4>
      <ul>
        {actions.map((action, index) => (
          <li key={`${action.type}-${index}`}>
            <button
              type="button"
              className="action-pill"
              onClick={() => onTrigger(action)}
            >
              {action.type}
              {action.target ? ` → ${action.target}` : ''}
              {action.confidence !== undefined
                ? ` · ${Math.round(action.confidence * 100)}%`
                : ''}
            </button>
            {action.rationale ? (
              <p className="action-rationale">{action.rationale}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ActionPanel

