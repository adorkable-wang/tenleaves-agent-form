import type { NextFunction, Request, Response } from 'express'

// 统一错误处理中间件：将异常转换为 { error } JSON 输出
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Zod 校验错误
  if (isZodError(err)) {
    return res.status(400).json({ error: '请求体格式不正确', issues: err.issues })
  }

  const message = err instanceof Error ? err.message : '服务器内部错误'
  res.status(500).json({ error: message })
}

function isZodError(err: unknown): err is { issues: unknown[] } {
  return Boolean(err && typeof err === 'object' && 'issues' in (err as any))
}

