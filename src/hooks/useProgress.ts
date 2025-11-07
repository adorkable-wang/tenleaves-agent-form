/**
 * useProgress（中文注释版）
 * - 根据 status（idle/loading/success/error）模拟与计算一个进度与剩余时间
 * - 仅用于前端 UI 反馈（非真实进度）
 */
import { useEffect, useMemo, useRef, useState } from 'react'

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

export interface ProgressState {
  progress: number
  etaMs: number | null
  formattedETA: string
  ariaText?: string
  reset: () => void
}

export function useProgress(status: LoadStatus, label = '正在分析文档'):
  ProgressState {
  const [progress, setProgress] = useState(0)
  const [etaMs, setEtaMs] = useState<number | null>(null)
  const startRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const ESTIMATED_MS = 16000
    if (status === 'loading') {
      startRef.current = performance.now()
      setProgress(5)
      setEtaMs(ESTIMATED_MS)

      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = window.setInterval(() => {
        if (!startRef.current) return
        const elapsed = performance.now() - startRef.current
        const ratio = Math.min(elapsed / ESTIMATED_MS, 0.95)
        setProgress(Math.max(5, Math.round(Math.min(ratio, 0.95) * 100)))
        setEtaMs(Math.max(ESTIMATED_MS - elapsed, 0))
      }, 250)
      return () => {
        if (timerRef.current) {
          window.clearInterval(timerRef.current)
          timerRef.current = null
        }
      }
    }

    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    startRef.current = null
    if (status === 'success') {
      setProgress(100)
      setEtaMs(0)
    } else {
      setProgress(0)
      setEtaMs(null)
    }
  }, [status])

  const formattedETA = useMemo(() => formatRemaining(etaMs), [etaMs])
  const ariaText = useMemo(
    () => (status === 'loading' ? `${label}，进度 ${progress}% ，预计剩余 ${formattedETA}` : undefined),
    [status, label, progress, formattedETA]
  )

  const reset = () => {
    setProgress(0)
    setEtaMs(null)
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    startRef.current = null
  }

  return { progress, etaMs, formattedETA, ariaText, reset }
}

function formatRemaining(ms: number | null): string {
  if (ms === null) return '计算中…'
  const seconds = Math.ceil(ms / 1000)
  if (seconds <= 0) return '即将完成'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes > 0) {
    return remainingSeconds ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`
  }
  return `${seconds}秒`
}
