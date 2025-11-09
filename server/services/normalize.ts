import type {
  AgentAnalyzeResult,
  AgentFieldGroup,
  AgentFieldOption,
  AgentFormField,
} from "../../src/agent";
import { DASHSCOPE_MODEL } from "../config";

type DashscopeMessage = {
  role: "assistant" | "system";
  content?: string | unknown[];
};

// 统一的置信度常量，便于集中调整阈值
const MIN_CONFIDENCE = 0.75;
const OPTION_CONF_CAP = 0.85;
const OPTION_CONF_BASE = 0.65;

export function extractPayload(
  content: DashscopeMessage["content"]
): Record<string, unknown> {
  if (!content) return {};
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed) return {};
    // 优先从文本中“提取 JSON”（去围栏/截取第一个 JSON 片段/宽松修复）
    const parsed = extractJsonFromText(trimmed) ?? tryParseJSON(trimmed);
    if (parsed && typeof parsed === "object") {
      return ensureStructure(parsed as Record<string, unknown>);
    }
    return ensureStructure({ summary: trimmed });
  }
  if (Array.isArray(content)) {
    const concatenated = content
      .map((chunk) => {
        if (typeof chunk === "string") return chunk;
        if (chunk && typeof chunk === "object" && "text" in chunk) {
          return typeof (chunk as { text?: string }).text === "string"
            ? (chunk as { text?: string }).text
            : "";
        }
        return "";
      })
      .join("")
      .trim();
    if (!concatenated) return {};
    const parsed =
      extractJsonFromText(concatenated) ?? tryParseJSON(concatenated);
    if (parsed && typeof parsed === "object") {
      return ensureStructure(parsed as Record<string, unknown>);
    }
    return ensureStructure({ summary: concatenated });
  }
  if (typeof content === "object") {
    return ensureStructure(content as Record<string, unknown>);
  }
  return ensureStructure({});
}

export function normalizeAgentResult(
  payload: Record<string, unknown>,
  formSchema: AgentFormField[]
): AgentAnalyzeResult {
  const backend =
    typeof payload.backend === "string"
      ? payload.backend
      : `dashscope:${DASHSCOPE_MODEL}`;

  const diagnostics = Array.isArray(payload.diagnostics)
    ? payload.diagnostics.filter(
        (item): item is string => typeof item === "string"
      )
    : undefined;

  const summary =
    typeof payload.summary === "string" ? payload.summary : undefined;

  const extractedPairs =
    payload.extractedPairs && typeof payload.extractedPairs === "object"
      ? Object.entries(payload.extractedPairs).reduce<Record<string, string>>(
          (acc, [key, value]) => {
            if (typeof value === "string") acc[key] = value;
            return acc;
          },
          {}
        )
      : {};

  const actions = Array.isArray(payload.actions)
    ? payload.actions
        .map((item) => normalizeAction(item))
        .filter(
          (action): action is NonNullable<ReturnType<typeof normalizeAction>> =>
            action !== null
        )
    : [];

  const rawGroups = Array.isArray(
    (payload as Record<string, unknown>).fieldGroups
  )
    ? (payload as { fieldGroups: unknown[] }).fieldGroups
    : [];

  const normalizedGroups = rawGroups
    .map((item, index) => normalizeGroup(item, index, formSchema.length))
    .filter(
      (item): item is { group: AgentFieldGroup; score: number } =>
        item !== null
    );

  normalizedGroups.sort((a, b) => b.score - a.score);

  const fieldGroups = normalizedGroups.map((item) => item.group);

  const autoSelectGroupId =
    fieldGroups.length === 1 ? fieldGroups[0].id : null;

  return {
    backend,
    summary,
    diagnostics,
    extractedPairs,
    actions,
    fieldGroups,
    autoSelectGroupId,
  };
}

function normalizeAction(item: unknown) {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : null;
  const target = typeof record.target === "string" ? record.target : undefined;
  const payload =
    record.payload && typeof record.payload === "object"
      ? (record.payload as Record<string, unknown>)
      : undefined;
  const confidence =
    typeof record.confidence === "number"
      ? clampConfidence(record.confidence)
      : 0.5;
  const rationale =
    typeof record.rationale === "string" ? record.rationale : undefined;
  if (!type) return null;
  return { type, target, payload, confidence, rationale };
}

function clampConfidence(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function tryParseJSON(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * 从“非严格 JSON 文本”中提取可解析的 JSON：
 * 1) 去掉 ```json ... ``` 的代码块围栏后尝试解析；
 * 2) 在长文本中定位第一个对象/数组片段（括号计数匹配）并解析；
 * 3) 宽松修复：
 *    - 为未加引号的键名补引号；
 *    - 将成对的单引号字符串替换为双引号；
 * 注意：此方法是“尽力而为”的容错，可能无法覆盖所有边界，但能显著提升解析成功率。
 */
function extractJsonFromText(text: string): unknown | null {
  const fenced = matchCodeFence(text);
  if (fenced) {
    const parsed = tryParseJSON(fenced);
    if (parsed != null) return parsed;
  }

  const jsonSlice = findFirstJsonSlice(text);
  if (jsonSlice) {
    const parsed = tryParseJSON(jsonSlice);
    if (parsed != null) return parsed;
  }

  // 宽松修复：仅在原文包含看似 JSON 的符号时尝试
  if (text.includes("{") || text.includes("[")) {
    const fixed = relaxFixJson(text);
    const viaFence = matchCodeFence(fixed);
    if (viaFence) {
      const parsed = tryParseJSON(viaFence);
      if (parsed != null) return parsed;
    }
    const slice2 = findFirstJsonSlice(fixed);
    if (slice2) {
      const parsed = tryParseJSON(slice2);
      if (parsed != null) return parsed;
    }
    const parsed = tryParseJSON(fixed);
    if (parsed != null) return parsed;
  }
  return null;
}

// 提取 ```json\n...``` 或 ```\n...``` 代码块中的内容
function matchCodeFence(input: string): string | null {
  const re = /```\s*(json)?\s*\n([\s\S]*?)\n```/i;
  const m = re.exec(input);
  return m ? m[2].trim() : null;
}

// 在混合文本中定位第一个“平衡”的 JSON 片段（对象或数组）
function findFirstJsonSlice(input: string): string | null {
  const idxBrace = input.indexOf("{");
  const idxBracket = input.indexOf("[");
  const startIdx =
    idxBrace === -1
      ? idxBracket
      : idxBracket === -1
      ? idxBrace
      : Math.min(idxBrace, idxBracket);
  if (startIdx === -1) return null;
  let i = startIdx;
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      if (!stack.length) break;
      const last = stack[stack.length - 1];
      if ((last === "{" && ch === "}") || (last === "[" && ch === "]"))
        stack.pop();
      else return null;
      if (!stack.length) {
        const slice = input.slice(startIdx, i + 1);
        return slice;
      }
    }
  }
  return null;
}

// 宽松修复：尽量把“近似 JSON”修成可解析的 JSON 字符串
function relaxFixJson(input: string): string {
  let s = input;
  // 去掉常见围栏
  s = s.replace(/```\s*(json)?/gi, "").replace(/```/g, "");
  // 将未加引号的键名补引号：{ key: value } -> { "key": value }
  s = s.replace(/([,{]\s*)([A-Za-z_][A-Za-z0-9_]*?)\s*:/g, '$1"$2":');
  // 将单引号包裹的字符串转为双引号（尽力而为）
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
  // 移除尾随逗号
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s;
}

function normalizeOptions(
  raw: unknown,
  meta?: { groupId?: string; groupLabel?: string }
): AgentFieldOption[] {
  const toOption = (input: unknown): AgentFieldOption | null => {
    if (typeof input === "string") {
      return {
        value: input,
        confidence: Math.min(
          OPTION_CONF_CAP,
          OPTION_CONF_BASE + input.length * 0.01
        ),
        groupId: meta?.groupId,
        groupLabel: meta?.groupLabel,
      };
    }
    if (!input || typeof input !== "object") return null;
    const record = input as Record<string, unknown>;
    const value =
      typeof record.value === "string"
        ? record.value
        : record.value != null
        ? String(record.value)
        : null;
    if (!value) return null;
    return {
      value,
      confidence:
        typeof record.confidence === "number"
          ? clampConfidence(record.confidence)
          : undefined,
      rationale:
        typeof record.rationale === "string"
          ? record.rationale
          : record.rationale != null
          ? String(record.rationale)
          : undefined,
      sourceText:
        typeof record.sourceText === "string" ? record.sourceText : undefined,
      groupId: meta?.groupId,
      groupLabel: meta?.groupLabel,
    };
  };

  if (Array.isArray(raw)) {
    return sanitizeOptions(
      raw
        .map((item) => toOption(item))
        .filter((item): item is AgentFieldOption => item !== null)
    );
  }

  const option = toOption(raw);
  return option ? sanitizeOptions([option]) : [];
}

function normalizeGroup(
  item: unknown,
  index: number,
  expectedFieldCount: number
): { group: AgentFieldGroup; score: number } | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const rawId = record.id;
  const id =
    typeof rawId === "string" && rawId.trim().length
      ? rawId
      : `group-${index + 1}`;
  const label = typeof record.label === "string" ? record.label : undefined;
  const providedConfidence =
    typeof record.confidence === "number"
      ? clampConfidence(record.confidence)
      : undefined;
  let rationale =
    typeof record.rationale === "string"
      ? record.rationale
      : record.rationale != null
      ? String(record.rationale)
      : undefined;
  const fieldCandidates: Record<string, AgentFieldOption[]> = {};
  const rawFieldCandidates = (
    record as {
      fieldCandidates?: unknown;
    }
  ).fieldCandidates;
  if (rawFieldCandidates && typeof rawFieldCandidates === "object") {
    for (const [fieldId, value] of Object.entries(
      rawFieldCandidates as Record<string, unknown>
    )) {
      const options = normalizeOptions(value, {
        groupId: id,
        groupLabel: label,
      });
      if (options.length) fieldCandidates[fieldId] = options;
    }
  }
  if (!Object.keys(fieldCandidates).length) return null;

  const fieldCount = Object.keys(fieldCandidates).length;
  const avgCandidateConfidence =
    fieldCount === 0
      ? 0
      : Object.values(fieldCandidates)
          .map((options) => options[0]?.confidence ?? MIN_CONFIDENCE)
          .reduce((sum, value) => sum + value, 0) / fieldCount;

  const coverageRatio =
    expectedFieldCount > 0
      ? Math.min(1, fieldCount / expectedFieldCount)
      : 1;

  const computedScore = clampConfidence(
    avgCandidateConfidence * coverageRatio
  );

  const finalConfidence =
    providedConfidence != null
      ? clampConfidence((providedConfidence + computedScore) / 2)
      : computedScore;

  if (!rationale?.trim().length) {
    rationale = "模型未提供明确理由";
  }
  return {
    group: {
      id,
      label,
      confidence: finalConfidence,
      rationale,
      fieldCandidates,
    },
    score: finalConfidence,
  };
}
function ensureStructure(payload: Record<string, unknown>): Record<string, unknown> {
  return payload;
}

function sanitizeOptions(options: AgentFieldOption[]): AgentFieldOption[] {
  return options
    .map((option) => ({
      ...option,
      confidence:
        typeof option.confidence === "number"
          ? clampConfidence(option.confidence)
          : undefined,
    }))
    .filter((option) => (option.confidence ?? 0) >= MIN_CONFIDENCE)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
}
