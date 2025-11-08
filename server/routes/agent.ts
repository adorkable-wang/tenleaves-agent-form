import type { Request, Response, Router } from "express";
import express from "express";
import { z } from "zod";
import type {
  AgentAnalyzeOptions,
  AgentAnalyzeResult,
  AgentDocument,
} from "../../src/agent";
import { buildPrompt } from "../services/prompt";
import { sendDashscope } from "../services/llm/dashscopeClient";
import { extractPayload, normalizeAgentResult } from "../services/normalize";

export const agentRouter: Router = express.Router();

const BodySchema = z.object({
  document: z.object({
    kind: z.literal("text"),
    content: z.string().min(1, "文档内容不能为空"),
    filename: z.string().optional(),
  }),
  options: z.object({
    formSchema: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          description: z.string().optional(),
          required: z.boolean().optional(),
          synonyms: z.array(z.string()).optional(),
          example: z.string().optional(),
        })
      )
      .min(1, "formSchema 不能为空"),
    instructions: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

// POST /api/agent/analyze
agentRouter.post(
  "/analyze",
  async (
    req: Request,
    res: Response<AgentAnalyzeResult | { error: string }>
  ) => {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "请求体格式不正确", issues: parsed.error.issues });
    }
    const { document, options } = parsed.data as {
      document: AgentDocument;
      options: AgentAnalyzeOptions;
    };
    try {
      const prompt = buildPrompt(
        document,
        options.formSchema,
        options.instructions
      );
      const data = await sendDashscope(prompt);
      const content = data.choices?.[0]?.message?.content as
        | string
        | unknown[]
        | undefined;
      const payload = extractPayload(content, options.formSchema);
      const normalized = normalizeAgentResult(payload, options.formSchema);
      res.json(normalized);
    } catch (error) {
      // 识别超时/中断，返回 504，便于前端区分
      if (isAbortError(error)) {
        return res.status(504).json({ error: '上游模型请求超时，请稍后重试' })
      }
      console.error(error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "LLM 调用异常",
      });
    }
  }
);

function isAbortError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    ((err as any).name === 'AbortError' ||
      /aborted|abort/i.test(String((err as any).message ?? '')))
  )
}
