import { useMemo } from "react";
import type {
  AgentAnalyzeResult,
  AgentFieldGroup,
  AgentFormField,
} from "../agent";

export type GroupPreview = {
  group: AgentFieldGroup;
  entries: Array<{
    fieldId: string;
    label: string;
    value: string;
    confidence?: number;
  }>;
  duplicateValues: Set<string>;
};

export function useGroupPreviews(
  result: AgentAnalyzeResult | null,
  schema: AgentFormField[]
): GroupPreview[] {
  const fieldLabelMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    schema.forEach((field) => {
      map[field.id] = field.label;
    });
    return map;
  }, [schema]);

  const formFieldOrder = useMemo(
    () => schema.map((field) => field.id),
    [schema]
  );

  return useMemo(() => {
    if (!result?.fieldGroups?.length) return [];
    return result.fieldGroups.map((group) => {
      const orderedEntries = formFieldOrder
        .map((fieldId) => {
          const candidate = group.fieldCandidates?.[fieldId]?.[0];
          if (!candidate?.value) return null;
          return {
            fieldId,
            label: fieldLabelMap[fieldId] ?? fieldId,
            value: candidate.value,
            confidence: candidate.confidence,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      const counts = new Map<string, number>();
      orderedEntries.forEach((entry) => {
        const normalized = entry.value.trim().toLowerCase();
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      });
      const duplicateValues = new Set<string>();
      counts.forEach((count, key) => {
        if (count > 1) duplicateValues.add(key);
      });

      return {
        group,
        entries: orderedEntries,
        duplicateValues,
      };
    });
  }, [result, fieldLabelMap, formFieldOrder]);
}
