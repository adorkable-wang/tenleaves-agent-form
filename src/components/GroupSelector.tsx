import React from 'react'
import type { AgentFieldGroup } from '../agent'

interface Props {
  groups: AgentFieldGroup[]
  selectedGroupId: string | null
  onSelect: (group: AgentFieldGroup) => void
}

export const GroupSelector: React.FC<Props> = ({ groups, selectedGroupId, onSelect }) => {
  if (!groups.length) return null
  return (
    <div className="group-selector">
      <h4>识别的候选组合</h4>
      <div className="group-selector__pills">
        {groups.map((group, index) => {
          const label = group.label ?? `组合 ${index + 1}`
          const isActive = selectedGroupId === group.id
          return (
            <button
              type="button"
              key={group.id}
              className={`group-pill${isActive ? ' group-pill--active' : ''}`}
              onClick={() => onSelect(group)}
            >
              {label}
              {group.confidence !== undefined
                ? ` · ${Math.round(group.confidence * 100)}%`
                : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default GroupSelector

