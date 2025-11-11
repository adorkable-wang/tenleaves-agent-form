import { useCallback, useEffect, useRef, useState } from 'react'

export function useProgressTimer(interval = 200) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const startAtRef = useRef<number | null>(null)
  const tickRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    startAtRef.current = Date.now()
    setElapsedMs(0)
    if (tickRef.current) {
      window.clearInterval(tickRef.current)
    }
    tickRef.current = window.setInterval(() => {
      if (startAtRef.current) {
        setElapsedMs(Date.now() - startAtRef.current)
      }
    }, interval)
  }, [interval])

  useEffect(() => stop, [stop])

  return { elapsedMs, startTimer: start, stopTimer: stop }
}
