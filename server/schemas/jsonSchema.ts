/**
 * 返回给模型的 JSON Schema（约束输出结构）
 */
export function agentSchema() {
  return {
    type: "object",
    properties: {
      backend: { type: "string" },
      summary: { type: "string" },
      diagnostics: {
        type: "array",
        items: { type: "string" },
      },
      extractedPairs: {
        type: "object",
        additionalProperties: { type: "string" },
      },
      fields: {
        type: "array",
        items: {
          type: "object",
          properties: {
            fieldId: { type: "string" },
            label: { type: "string" },
            value: { type: ["string", "null"] },
            confidence: { type: "number" },
            sourceText: { type: ["string", "null"] },
            rationale: { type: ["string", "null"] },
          },
          required: ["fieldId", "label", "value", "confidence"],
        },
      },
      fieldGroups: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: ["string", "null"] },
            confidence: { type: ["number", "null"] },
            rationale: { type: ["string", "null"] },
            fields: {
              type: "object",
              additionalProperties: {
                anyOf: [
                  { type: "string" },
                  {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      confidence: { type: ["number", "null"] },
                      rationale: { type: ["string", "null"] },
                      sourceText: { type: ["string", "null"] },
                    },
                    required: ["value"],
                  },
                ],
              },
            },
          },
          required: ["id", "fields"],
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
            confidence: { type: "number" },
            rationale: { type: "string" },
          },
          required: ["type", "confidence"],
        },
      },
    },
    required: ["fields", "extractedPairs"],
  };
}
