# Document-aware Agent Form

This project demonstrates how to integrate an agent workflow inside a React + TypeScript + Vite application. Users can upload a document, let the agent reason about the content, and review an auto-filled form populated from the results. The agent layer lives in `src/agent/` and is designed so it can be extracted into its own npm package later.

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173 to try the demo. Upload 一个 `.txt`、`.md`、`.json`、`.docx` 或 `.xlsx` 文件，应用会先转换成文本，再通过大模型识别并自动填表，最终结果依然可以人工修改。

## How the agent integration works

- `src/agent/` houses the agent abstraction。`AgentRunner` 始终通过 `RemoteAgentBackend` 调用后端接口，把文档内容与表单 schema 发给 LLM。
- `src/App.tsx` wires the UI: it reads the uploaded file as text, calls the agent runner with `{ kind: 'text', content, filename }`, and mirrors the agent output into controlled form fields。
- `src/utils/fileParser.ts` 负责把上传的 Word（DOCX）、Excel（XLSX/CSV）、纯文本、Markdown 等常见格式转换成简洁的文本，再交给智能体分析，并在界面里展示转换提示。
- The agent returns `fields`, `summary`, `diagnostics`, and `extractedPairs`。LLM 端需要返回这一结构，前端会直接展示。

### Customising the form schema

Update the `formSchema` array in `src/App.tsx` to add/remove fields, tweak synonyms, or extend hints. The schema is passed directly to the agent so the heuristics know which values to look for.

## 接入真实 LLM 后端

前端只发送 `{ document, options }` 到 `RemoteAgentBackend` 配置的地址（默认 `/api/agent/analyze`），因此真正的模型调用应该放在服务端。项目提供了一个 Express 示例（`server/agentServer.ts`）演示如何使用 OpenAI Responses API：

```bash
# 环境变量
cp .env.example .env
echo "OPENAI_API_KEY=sk-..." >> .env
echo "VITE_AGENT_ENDPOINT=/api/agent/analyze" >> .env
echo "VITE_AGENT_PROXY_TARGET=http://localhost:8787" >> .env

# 安装并启动服务端
pnpm install
pnpm agent:server
```

`server/agentServer.ts` 会读取表单 schema，构造提示词，让模型直接返回符合 `AgentAnalyzeResult` 结构的 JSON。你可以把它替换成任意模型或企业内部服务，只要维持相同的 HTTP 输入/输出格式即可。开发阶段通过 Vite 代理（`VITE_AGENT_ENDPOINT=/api/...` + `VITE_AGENT_PROXY_TARGET`）即可免去跨域问题；部署时则配置反向代理或让后端提供同一路径。

> ⚠️ 不要在浏览器端保存 API Key。确保所有模型调用都走服务端或受控网关。

## Packaging the agent for reuse

The folder structure already isolates the reusable logic:

1. Copy `src/agent/` into a new package (e.g. `packages/document-agent`) or move it into a dedicated repository.
2. Create an `index.ts` entry point that re-exports the interfaces and backends you want to share—`AgentRunner`, `AgentBackend`, `AgentFormField`, etc.
3. Add build tooling (`tsup`, `rollup`, or plain `tsc`) and set up `package.json` exports for ESM/CJS consumers.
4. Publish the package to npm, then depend on it from other projects: `pnpm add @your-scope/document-agent`.
5. Applications can now import the package and focus purely on UI or orchestration, while the shared agent logic handles file analysis.

## Suggested next steps

- Hook the agent backend up to your preferred LLM or toolchain (OpenAI Assistants, Anthropic, Moonshot, etc.).
- Add a persistence layer so multiple documents or incremental conversations can be processed in sequence.
- Extend the UI with confidence indicators, inline diffing between old/new values, or multi-step forms powered by the same agent abstractions.
