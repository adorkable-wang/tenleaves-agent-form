# 文档智能填表（React + TS + Vite）

该项目演示“上传文档 → 大模型抽取 → 自动填表”的完整链路。前端只呈现“表单 + 右下角悬浮智能助手”，上传文本/Word/Excel 等文档即可识别并回填。

## 快速开始

```bash
pnpm install

# 配置环境变量
cp .env.example .env
# 需要配置达摩盘 API Key（必填）
echo "DASHSCOPE_API_KEY=your_key" >> .env
# 可选：模型与超时/重试
echo "DASHSCOPE_MODEL=qwen-plus" >> .env
echo "LLM_RETRIES=1" >> .env
# 若需要启用超时检测（默认关闭），可配置如下：
echo "LLM_TIMEOUT_ENABLED=true" >> .env
echo "LLM_TIMEOUT_MS=45000" >> .env

# 启动服务端（Express）
pnpm agent:server

# 启动前端
pnpm dev

# 开发阶段建议同时执行类型检查
pnpm typecheck
```

> 说明：**不配置 `LLM_TIMEOUT_ENABLED` 时表示关闭超时检测**，即请求将一直等待 DashScope 的响应；只有在将其设为 `true` 时，`LLM_TIMEOUT_MS` 的数值才会生效，可按需调整毫秒值。

开发时默认通过 Vite 代理把 `/api/agent/analyze` 转发到 `http://localhost:8787`。可通过环境变量调整：

- `VITE_AGENT_ENDPOINT=/api/agent/analyze`（前端调用路径）
- `VITE_AGENT_PROXY_TARGET=http://localhost:8787`（代理目标）

## 体系结构

- 前端智能助手与表单

  - `src/App.tsx`：只渲染可编辑表单（AutofillForm）+ 悬浮助手（FloatingAssistant）。
  - `src/components/FloatingAssistant.tsx`：支持文本输入、拖拽/粘贴/选择文件，调用智能体后回填表单。
  - `src/utils/fileParser.ts`：浏览器侧把 DOCX/XLSX/CSV/TXT/MD/JSON 等转成纯文本，统一交给智能体。
  - 表单 Schema 在 `src/schema/formSchema.ts`，初始值工具 `src/schema/utils.ts`。

- 智能体抽象（可封装为 npm）

  - `src/agent/`：统一类型与调用入口。`RemoteAgentBackend` 通过 HTTP 调用后端接口。
  - `src/lib/index.ts`：打包导出，供其他项目复用（types、client、DOM 工具、文件解析等）。

- 服务端（Express + DashScope）
  - `server/index.ts`：应用入口与中间件。
  - `server/routes/agent.ts`：`POST /api/agent/analyze` 接收前端 `{ document, options }`，构造提示词并调用达摩盘。
  - `server/services/llm/dashscopeClient.ts`：请求 DashScope（支持 JSON Schema 约束）。
  - `server/services/normalize.ts`：容错解析/归一化（字段、候选项、组合、extractedPairs、actions）。
  - `server/services/prompt.ts`：结合 schema 生成提示词。
- 功能追踪
  - `docs/feature-status.json`：功能清单与优先级/状态记录（勿手改）。
  - `docs/feature-status.md`：由脚本自动生成的可读版进度表。
  - `pnpm feature:update -- --id B6 --status done`：更新状态并同步文档，status 取 `pending | in_progress | done`。
- `server/config.ts`：读取 `DASHSCOPE_*`、`LLM_TIMEOUT_ENABLED`、`LLM_TIMEOUT_MS`、`LLM_RETRIES` 等配置。

> 安全提示：不要在浏览器端保存任何 API Key，所有模型调用均放在服务端。

## 交互说明

- 悬浮助手（右下角）支持：
  - 文本问题输入；
  - 文件拖拽/粘贴/选择（受支持格式见 `SUPPORTED_FORMAT_LABEL`）。
- 识别结果按字段/组合自动回填表单；你可以在表单内继续编辑。
- 分析过程提供“乐观进度”与用时展示：解析文件 → 准备请求 → 等待模型响应 → 解析回填（由任务列表 `src/components/assistant/TaskList.tsx` 集成进度条与状态徽章）。
- LLM 返回的字段/候选会附带 `confidence`，服务端仅保留置信度 ≥ 75% 的条目，并按置信度降序排序。

## 可复用（npm 准备）

`src/lib/index.ts` 暴露常用能力：

- Types 与后端封装：`createRemoteAgentRunner`、`analyzeDocumentWithDefaultAgent` 等；
- 轻量客户端：`createAgentClient({ endpoint, apiKey })`；
- 表单/工具：`formSchema`、`createInitialFormValues(schema)`；
- 文件解析与常量：`parseFileToAgentDocument(file)`、`ACCEPT_ATTRIBUTE_VALUE`、`SUPPORTED_FORMAT_LABEL` 等。

使用示例：

```ts
import {
  createAgentClient,
  formSchema,
  createInitialFormValues,
  parseFileToAgentDocument,
} from "./src/lib";

const client = createAgentClient({ endpoint: "/api/agent/analyze" });

async function handle(file: File) {
  const parsed = await parseFileToAgentDocument(file);
  const result = await client.analyze(parsed.document, { formSchema });
  const initial = createInitialFormValues(formSchema);
  // 将 result 融合到你的表单 UI
}
```

## 变更记录（相对早期版本）

- 移除旧的“分析面板/候选列表/进度条”等组件与样式，统一为“表单 + 悬浮助手”的交互方式；
- 服务端改为 DashScope（可配置模型/超时/重试），路由模块化；
- 归一化层增强，兼容更宽松的 LLM 输出；
- UnoCSS 精简，仅保留当前 UI 所需样式。
