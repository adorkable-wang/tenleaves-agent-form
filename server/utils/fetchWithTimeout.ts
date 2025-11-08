export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  { timeoutMs = 18000, retries = 1 }: { timeoutMs?: number; retries?: number } = {}
): Promise<Response> {
  let attempt = 0
  let lastErr: unknown
  while (attempt <= retries) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(t)
      if (!res.ok && res.status >= 500 && attempt < retries) {
        attempt++
        continue
      }
      return res
    } catch (err) {
      clearTimeout(t)
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

