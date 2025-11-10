/**
 * 返回给模型的 JSON Schema（约束输出结构）
 */
export function agentSchema() {
  return {
    type: "object",
    properties: {
      summary: { type: "string" },
      diagnostics: {
        type: "array",
        items: { type: "string" },
      },
      extractedPairs: {
        type: "object",
        additionalProperties: { type: "string" },
      },
      fieldGroups: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: ["string", "null"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            rationale: { type: "string" },
            fieldCandidates: {
              type: "object",
              additionalProperties: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    value: { type: "string" },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    rationale: { type: ["string", "null"] },
                    sourceText: { type: ["string", "null"] },
                  },
                  required: ["value", "confidence"],
                },
              },
            },
          },
          required: ["id", "confidence", "rationale", "fieldCandidates"],
        },
      },
      actions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            target: { type: "string" },
            payload: { type: "object" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            rationale: { type: "string" },
          },
          required: ["type", "confidence"],
        },
      },
    }
  };
}
