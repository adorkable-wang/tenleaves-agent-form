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
请阅读以下文档内容，并提取指定字段的值。如果无法确定，请将该字段的 value 设为 null，并在 rationale 中说明原因。

额外说明: ${instructions ?? "无"}

待提取字段:
${fieldLines}

文档内容:
${document.content}

如果文档包含相互关联的一组字段，请使用 fieldGroups 返回：
- 每个分组包含 id、label(可选)、confidence(0~1，可选)、rationale(可选)、fields 对象；
- fields 形如 { 字段id: 候选 }，候选可以是字符串，或 { value, confidence(0~1，可选), rationale(可选), sourceText(可选) }；
请保证 fields 中的键与上面的字段 id 对齐。

如果文档包含额外操作或流程建议，请返回 actions 数组，每项包含 type、target(可选)、payload(可选)、confidence(0~1) 和 rationale。
`;
}
