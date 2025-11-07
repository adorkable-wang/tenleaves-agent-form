/**
 * AnalysisStatus
 * - 展示智能体状态、进度、剩余时间与错误提示
 */
import React from 'react'

type Status = 'idle' | 'loading' | 'error' | 'success'

interface Props {
  status: Status
  selectedFile?: string
  parsedFormat?: string
  completionText?: string
  progress?: number
  ariaText?: string
  formattedETA?: string
  error?: string | null
}

const STATUS_LABELS: Record<Status, string> = {
  idle: '空闲',
  loading: '分析中',
  error: '出错',
  success: '已完成',
}

export const AnalysisStatus: React.FC<Props> = ({
  status,
  selectedFile,
  parsedFormat,
  completionText,
  progress,
  ariaText,
  formattedETA,
  error,
}) => {
  return (
    <div className="analysis-panel">
      <h2>智能体状态</h2>
      <div className="analysis-panel__status">
        <span className={`status status--${status}`}>{STATUS_LABELS[status]}</span>
        {selectedFile ? <span>{selectedFile}</span> : <span>尚未选择文件</span>}
        {parsedFormat ? <span className="status-format">识别格式：{parsedFormat}</span> : null}
        {completionText ? <span>{completionText}</span> : <span>等待文件分析…</span>}
      </div>
      {status === 'loading' ? (
        <>
          <div
            className="progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-valuetext={ariaText}
          >
            <div
              className="progress-bar__indicator"
              style={{ width: `${Math.min(Math.max(progress ?? 5, 5), 100)}%` }}
            />
          </div>
          <div className="progress-meta">
            <span>{progress ?? 0}%</span>
            <span>预计剩余：{formattedETA ?? '-'}</span>
          </div>
        </>
      ) : null}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

export default AnalysisStatus
