import type {
  AgentAnalyzeResult,
  AgentFieldGroup,
  AgentFieldInference,
  AgentFieldOption,
  AgentFormField,
} from "../../src/agent";
import { DASHSCOPE_MODEL } from "../config";

type DashscopeMessage = {
  role: "assistant" | "system";
  content?: string | unknown[];
};

// 统一的“默认置信度”常量，便于后续统一调整
const DEFAULT_CONFIDENCE = 0.75;
const OPTION_CONF_CAP = 0.85;
const OPTION_CONF_BASE = 0.65;

export function extractPayload(
  content: DashscopeMessage["content"],
  formSchema: AgentFormField[]
): Record<string, unknown> {
  if (!content) return {};
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed) return {};
    const parsed = tryParseJSON(trimmed);
    if (parsed && typeof parsed === "object") {
      return applySchemaDefaults(parsed as Record<string, unknown>, formSchema);
    }
    return applySchemaDefaults({ summary: trimmed }, formSchema);
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
    const parsed = tryParseJSON(concatenated);
    if (parsed && typeof parsed === "object") {
      return applySchemaDefaults(parsed as Record<string, unknown>, formSchema);
    }
    return applySchemaDefaults({ summary: concatenated }, formSchema);
  }
  if (typeof content === "object") {
    return applySchemaDefaults(content as Record<string, unknown>, formSchema);
  }
  return applySchemaDefaults({}, formSchema);
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

  const rawGroups = Array.isArray((payload as Record<string, unknown>).groups)
    ? (payload as { groups: unknown[] }).groups
    : Array.isArray((payload as Record<string, unknown>).fieldGroups)
    ? (payload as { fieldGroups: unknown[] }).fieldGroups
    : [];

  const fieldGroups = rawGroups
    .map((item, index) => normalizeGroup(item, index))
    .filter((group): group is AgentFieldGroup => group !== null);

  const groupOptionMap = fieldGroups.reduce<Record<string, AgentFieldOption[]>>(
    (acc, group) => {
      Object.entries(group.fields).forEach(([fieldId, option]) => {
        const optionWithMeta: AgentFieldOption = {
          ...option,
          groupId: option.groupId ?? group.id,
          groupLabel: option.groupLabel ?? group.label,
          confidence: option.confidence ?? group.confidence,
        };
        if (!acc[fieldId]) acc[fieldId] = [];
        acc[fieldId].push(optionWithMeta);
      });
      return acc;
    },
    {}
  );

  const fields: AgentFieldInference[] = Array.isArray(payload.fields)
    ? (payload.fields
        .map((item) => normalizeFieldInference(item, formSchema, groupOptionMap))
        .filter((item): item is AgentFieldInference => item !== null))
    : formSchema.map((field) =>
        buildFieldFromObject(field, (payload as Record<string, unknown>)[field.id], groupOptionMap)
      )

  // 用 extractedPairs 对空值进行一次补全
  mergePairsIntoFields(fields, extractedPairs)

  for (const field of fields) {
    if (field.value && field.value !== "[object Object]") {
      extractedPairs[field.fieldId] = field.value;
    }
  }

  return {
    backend,
    fields,
    summary,
    diagnostics,
    extractedPairs,
    actions,
    fieldGroups,
  };
}

function normalizeFieldInference(
  item: unknown,
  formSchema: AgentFormField[],
  groupOptionMap: Record<string, AgentFieldOption[]>
): AgentFieldInference | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const fieldId = typeof record.fieldId === "string" ? record.fieldId : null;
  if (!fieldId) return null;
  const schema = formSchema.find((field) => field.id === fieldId);
  const label =
    typeof record.label === "string"
      ? record.label
      : schema
      ? schema.label
      : fieldId;
  const value = pickValue(record.value)
  let confidence =
    typeof record.confidence === "number"
      ? clampConfidence(record.confidence)
      : value
      ? DEFAULT_CONFIDENCE
      : 0;
  const rationale =
    typeof record.rationale === "string"
      ? record.rationale
      : record.rationale != null
      ? String(record.rationale)
      : undefined;
  const sourceText =
    typeof record.sourceText === "string" ? record.sourceText : undefined;

  const options = normalizeOptions(record.options, undefined);
  const groupOptions = groupOptionMap[fieldId];
  const mergedOptions = mergeOptions(groupOptions, options);

  if (!value && mergedOptions.length) {
    value = mergedOptions[0].value;
    confidence = mergedOptions[0].confidence ?? confidence;
  }

  return {
    fieldId,
    label,
    value,
    confidence,
    rationale,
    sourceText,
    options: mergedOptions,
  };
}

function buildFieldFromObject(
  schema: AgentFormField,
  value: unknown,
  groupOptionMap: Record<string, AgentFieldOption[]>
): AgentFieldInference {
  const normalized = pickValue(value)
  const base: AgentFieldInference = {
    fieldId: schema.id,
    label: schema.label,
    value: normalized,
    confidence: normalized ? DEFAULT_CONFIDENCE : 0,
  };
  const options = groupOptionMap[schema.id];
  return options?.length ? { ...base, options } : base;
}

// 从多种返回形态中提取字符串值：string | {value} | [string] | [{value}] | 其他
function pickValue(input: unknown): string | null {
  if (input == null) return null
  if (typeof input === 'string') return input
  if (Array.isArray(input)) {
    const first = input[0]
    return pickValue(first)
  }
  if (typeof input === 'object' && 'value' in (input as Record<string, unknown>)) {
    const inner = (input as Record<string, unknown>).value
    return pickValue(inner)
  }
  const s = String(input)
  return s === '[object Object]' ? null : s
}

// 用 extractedPairs 补全 fields 的空值
function mergePairsIntoFields(fields: AgentFieldInference[], pairs: Record<string, string>) {
  for (const f of fields) {
    if (!f.value) {
      const v = pairs[f.fieldId]
      if (v && v.trim()) {
        f.value = v
        if (!f.confidence || f.confidence === 0) f.confidence = DEFAULT_CONFIDENCE
      }
    }
  }
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

function normalizeOptions(
  raw: unknown,
  meta?: { groupId?: string; groupLabel?: string }
): AgentFieldOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): AgentFieldOption | null => {
      if (typeof item === "string") {
        return {
          value: item,
          confidence: Math.min(OPTION_CONF_CAP, OPTION_CONF_BASE + item.length * 0.01),
          groupId: meta?.groupId,
          groupLabel: meta?.groupLabel,
        };
      }
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
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
    })
    .filter((item): item is AgentFieldOption => item !== null);
}

function mergeOptions(
  base: AgentFieldOption[] | undefined,
  extras: AgentFieldOption[]
): AgentFieldOption[] {
  const map = new Map<string, AgentFieldOption>();
  for (const option of base ?? []) map.set(optionKey(option), option);
  for (const option of extras)
    if (!map.has(optionKey(option))) map.set(optionKey(option), option);
  return Array.from(map.values());
}

function optionKey(option: AgentFieldOption): string {
  return JSON.stringify([option.groupId ?? 'field', option.value])
}

function normalizeGroup(item: unknown, index: number): AgentFieldGroup | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const rawId = record.id;
  const id =
    typeof rawId === "string" && rawId.trim().length
      ? rawId
      : `group-${index + 1}`;
  const label = typeof record.label === "string" ? record.label : undefined;
  const confidence =
    typeof record.confidence === "number"
      ? clampConfidence(record.confidence)
      : undefined;
  const rationale =
    typeof record.rationale === "string"
      ? record.rationale
      : record.rationale != null
      ? String(record.rationale)
      : undefined;
  const fields: Record<string, AgentFieldOption> = {};
  const rawFields = record.fields;
  if (rawFields && typeof rawFields === "object") {
    for (const [fieldId, value] of Object.entries(
      rawFields as Record<string, unknown>
    )) {
      const options = normalizeOptions(value, {
        groupId: id,
        groupLabel: label,
      });
      if (options.length) fields[fieldId] = options[0];
      else if (typeof value === "string")
        fields[fieldId] = { value, groupId: id, groupLabel: label };
    }
  }
  if (!Object.keys(fields).length) return null;
  return { id, label, confidence, rationale, fields };
}

function applySchemaDefaults(
  payload: Record<string, unknown>,
  formSchema: AgentFormField[]
) {
  for (const field of formSchema) {
    if (!(field.id in payload)) payload[field.id] = null;
  }
  return payload;
}
