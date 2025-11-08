/**
 * 服务端配置（环境变量读取与校验）
 */
export const PORT = Number(process.env.PORT ?? 8787)
export const DASHSCOPE_ENDPOINT =
  process.env.DASHSCOPE_ENDPOINT ??
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
export const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL ?? 'qwen-plus'
export const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY

if (!DASHSCOPE_API_KEY) {
  throw new Error('缺少 DASHSCOPE_API_KEY，请在 .env 中配置')
}

// LLM 请求的超时与重试次数（可按环境调整）
export const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 20000)
export const LLM_RETRIES = Number(process.env.LLM_RETRIES ?? 1)
