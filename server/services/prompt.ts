import type { AgentDocument, AgentFormField } from "../../shared/agent-types";

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
# 任务说明
你是资深信息抽取助手，请根据给定的表单字段从用户文档中提取信息。若某字段无法确定，请返回 value: null，并在 rationale 中说明原因，禁止凭空杜撰。

# 自定义补充
${instructions ?? "无"}

# 表单字段
${fieldLines}

# 用户文档
${document.content}

# 输出规范
1. 仅按“实体”分组
   - 单实体：fieldGroups 必须只有 1 项，并在该分组内尽量覆盖全部字段（确实无法确定的字段可省略对应 key，但禁止把字段拆成多个分组）。
   - 多实体：每个实体对应 1 个分组，分组内部尽量覆盖全部字段；严禁按字段拆分。
2. 分组结构
   - 每个分组需提供 id（必填）、label（可选）、confidence(0~1，必填)、rationale（必填，描述信心来源）。
   - fieldCandidates: { 字段id: 候选数组 }，字段 id 必须来自表单字段列表。
   - 候选必须是对象 { value, confidence(0~1), rationale?, sourceText? }，禁止返回字符串或其他简写。
3. 置信度要求
   - 请为每个分组及候选提供可信的 confidence；若把握不足，请给出保守分值并在 rationale 中解释原因。
   - 无需排序、无需过滤，服务端会执行统一的阈值（保留 ≥0.75）与排序策略。
4. Actions（可选）
   - 存在额外复核/处理建议时，可返回 actions 数组；每项至少包含 type 与 confidence，可选 target/payload/rationale。

# 格式限制
- 输出必须严格符合提供的 JSON Schema，禁止额外字段。
- 禁止输出任何解释性自然语言或总结。
- 禁止使用代码块围栏（如 \`\`\`json）。
`;

}
