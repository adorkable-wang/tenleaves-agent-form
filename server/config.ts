/**
 * 服务端配置（环境变量读取与校验）
 */
export const PORT = Number(process.env.PORT ?? 8787);
export const DASHSCOPE_ENDPOINT =
  process.env.DASHSCOPE_ENDPOINT ??
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
export const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL ?? "qwen-turbo";
export const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;

if (!DASHSCOPE_API_KEY) {
  throw new Error("缺少 DASHSCOPE_API_KEY，请在 .env 中配置");
}

// LLM 请求的超时与重试次数（可按环境调整）
export const LLM_TIMEOUT_ENABLED = parseBoolean(
  process.env.LLM_TIMEOUT_ENABLED,
  false
);
export const LLM_TIMEOUT_MS = parsePositiveNumber(
  process.env.LLM_TIMEOUT_MS,
  20000
);
export const LLM_RETRIES = parseNonNegativeInt(process.env.LLM_RETRIES, 1);

/**
 * 下述解析函数用于保障配置的可控性：
 * - parseBoolean：将 'true'/'1' 等转换为布尔值，默认 false
 * - parsePositiveNumber：限制必须为有限正数
 * - parseNonNegativeInt：限制必须为有限非负整数
 */
function parseBoolean(input: string | undefined, fallback: boolean): boolean {
  if (typeof input !== "string") return fallback;
  return ["1", "true", "yes", "on"].includes(input.trim().toLowerCase());
}

function parsePositiveNumber(
  input: string | undefined,
  fallback: number
): number {
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInt(
  input: string | undefined,
  fallback: number
): number {
  const parsed = Number(input);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.floor(parsed);
  }
  return fallback;
}
