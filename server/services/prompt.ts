import type { AgentDocument } from "../../src/agent";
import type { AgentFormField } from "../../src/agent";

/**
 * 构造提示词：
 * - 合成表单字段及其同义词/描述
 * - 附带用户文档文本
 */
export function buildPrompt(
  document: AgentDocument,
  fields: AgentFormField[],
  instructions?: string
) {
  const fieldLines = fields
    .map((field) => {
      const synonyms = field.synonyms?.length
        ? `同义词: ${field.synonyms.join(", ")}.`
        : "";
      return `- ${field.label} (id: ${field.id}) ${synonyms} 说明: ${
        field.description ?? "无"
      }`;
    })
    .join("\n");

  return `
请根据给定表单字段，从文档中提取信息；若无法确定，请将该字段的 value 设为 null，并在 rationale 中说明原因。

自定义补充: ${instructions ?? "无"}

字段列表:
${fieldLines}

文档内容:
${document.content}

输出要求:
1. 必须返回 fieldGroups（即使只有单一实体也需放入分组）。每个分组包含：
   - id（必填）、label（可选）
   - confidence(0~1) 及 rationale（说明信心来源）
   - fieldCandidates: { 字段id: 候选数组 }，字段 id 必须与上述字段列表一致。候选可以是字符串，或 { value, confidence(0~1), rationale?, sourceText? }。仅保留 confidence ≥ 0.75 的候选，排序由服务端完成。
2. 如果存在额外流程或操作建议，返回 actions 数组；每项至少包含 type 与 confidence，可选 target/payload/rationale。
3. 请为每个字段及候选提供可信的 confidence(0~1)；缺失或不确定时使用 null 并说明原因。
4. fieldGroups 的整体排序由服务端处理，你只需给出真实或保守的置信度并在 rationale 中说明依据。

格式限制:
- 输出必须严格符合提供的 JSON Schema；
- 不得包含额外解释文本；
- 禁止使用代码块围栏（如 \`\`\`json）。
`;
}
