import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import UnoCSS from 'unocss/vite'

function computeBasePath(endpoint: string): string | null {
  try {
    const url = new URL(endpoint, 'http://localhost')
    const trimmed =
      url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '')
    if (trimmed === '/' || trimmed === '') {
      return null
    }
    const lastSlashIndex = trimmed.lastIndexOf('/')
    if (lastSlashIndex <= 0) {
      return trimmed
    }
    const base = trimmed.slice(0, lastSlashIndex)
    return base === '' ? '/' : base
  } catch {
    return null
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const endpoint = env.VITE_AGENT_ENDPOINT ?? '/api/agent/analyze'
  const proxyTarget = env.VITE_AGENT_PROXY_TARGET ?? 'http://localhost:8787'
  const shouldProxy = endpoint.startsWith('/')
  const basePath = shouldProxy ? computeBasePath(endpoint) : null
  const proxyConfig =
    shouldProxy && basePath
      ? {
          [basePath]: {
            target: proxyTarget,
            changeOrigin: true,
          },
        }
      : undefined

  return {
    plugins: [react(), UnoCSS()],
    server: {
      proxy: proxyConfig,
    },
    preview: {
      proxy: proxyConfig,
    },
  }
})
