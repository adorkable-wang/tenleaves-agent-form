import type {
  AgentAnalyzeResult,
  AgentFieldGroup,
  AgentFieldOption,
  AgentFormField,
} from "../../shared/agent-types";
import { DASHSCOPE_MODEL } from "../config";
import { extractPayload as extractPayloadImpl } from "./normalize/json";
import {
  clampConfidence,
  MIN_CONFIDENCE,
  normalizeOptions,
} from "./normalize/options";

export { extractPayloadImpl as extractPayload };

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

  let rawGroups = Array.isArray(
    (payload as Record<string, unknown>).fieldGroups
  )
    ? (payload as { fieldGroups: unknown[] }).fieldGroups
    : [];

  rawGroups = coalesceFieldLevelGroups(rawGroups, formSchema);

  const normalizedGroups = rawGroups
    .map((item, index) => normalizeGroup(item, index, formSchema.length))
    .filter(
      (item): item is { group: AgentFieldGroup; score: number } =>
        item !== null
    );

  normalizedGroups.sort((a, b) => b.score - a.score);

  const fieldGroups = normalizedGroups.map((item) => item.group);

  return {
    backend,
    summary,
    diagnostics,
    extractedPairs,
    actions,
    fieldGroups,
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

function coalesceFieldLevelGroups(
  groups: unknown[],
  formSchema: AgentFormField[]
): unknown[] {
  if (groups.length <= 1) return groups;
  const allowedFieldIds = new Set(formSchema.map((item) => item.id));
  const seenFields = new Set<string>();

  type FieldLevelRecord = { record: Record<string, unknown>; fieldId: string };

  const fieldLevelGroups: FieldLevelRecord[] = [];

  for (const group of groups) {
    if (!group || typeof group !== "object") return groups;
    const record = group as Record<string, unknown>;
    const candidates = record.fieldCandidates;
    if (!candidates || typeof candidates !== "object") return groups;
    const keys = Object.keys(candidates as Record<string, unknown>);
    if (keys.length !== 1) return groups;
    const fieldId = keys[0];
    if (!allowedFieldIds.has(fieldId)) return groups;
    if (seenFields.has(fieldId)) return groups;
    seenFields.add(fieldId);
    fieldLevelGroups.push({ record, fieldId });
  }

  if (!fieldLevelGroups.length || fieldLevelGroups.length > allowedFieldIds.size) {
    return groups;
  }

  const mergedFieldCandidates: Record<string, unknown[]> = {};
  const rationales: string[] = [];
  const confidences: number[] = [];
  let label: string | undefined;

  for (const { record, fieldId } of fieldLevelGroups) {
    if (!label && typeof record.label === "string" && record.label.trim()) {
      label = record.label.trim();
    }
    const candidates = record.fieldCandidates as Record<string, unknown>;
    const rawValue = candidates[fieldId];
    const arrayValue = Array.isArray(rawValue) ? rawValue : [rawValue];
    mergedFieldCandidates[fieldId] = [
      ...(mergedFieldCandidates[fieldId] ?? []),
      ...arrayValue,
    ];

    if (typeof record.rationale === "string" && record.rationale.trim()) {
      rationales.push(record.rationale.trim());
    }
    if (typeof record.confidence === "number" && Number.isFinite(record.confidence)) {
      confidences.push(clampConfidence(record.confidence));
    }
  }

  const mergedGroup: Record<string, unknown> = {
    id: "entity_1",
    label,
    fieldCandidates: mergedFieldCandidates,
  };

  if (rationales.length) {
    mergedGroup.rationale = rationales.join("；");
  }
  if (confidences.length) {
    mergedGroup.confidence =
      confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
  }

  return [mergedGroup];
}
