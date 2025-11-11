type FetchWithTimeoutOptions = {
  timeoutMs?: number
  retries?: number
  enableTimeout?: boolean
}

/**
 * fetchWithTimeout
 * - 支持可选的超时控制：当 enableTimeout=false 时，不会主动 Abort
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  { timeoutMs = 18000, retries = 1, enableTimeout = true }: FetchWithTimeoutOptions = {}
): Promise<Response> {
  let attempt = 0
  let lastErr: unknown
  while (attempt <= retries) {
    const controller = enableTimeout ? new AbortController() : null
    const timer =
      enableTimeout && timeoutMs > 0 ? setTimeout(() => controller?.abort(), timeoutMs) : null
    try {
      const res = await fetch(url, {
        ...init,
        ...(controller ? { signal: controller.signal } : {}),
      })
      if (timer) clearTimeout(timer)
      if (!res.ok && res.status >= 500 && attempt < retries) {
        attempt++
        continue
      }
      return res
    } catch (err) {
      if (timer) clearTimeout(timer)
      lastErr = err
      // 仅在网络/超时情况下重试
      if (attempt < retries) {
        attempt++
        continue
      }
      throw err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('请求失败')
}
