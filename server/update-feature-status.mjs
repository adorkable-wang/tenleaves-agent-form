#!/usr/bin/env node
/**
 * 功能状态追踪脚本
 * - 读取 docs/feature-status.json
 * - 可通过 --id --status 更新功能状态
 * - 自动生成 docs/feature-status.md 概览
 *
 * 用法示例：
 *   pnpm feature:update -- --id B6 --status done
 *   pnpm feature:update            // 仅重新生成 Markdown
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataPath = path.join(root, "docs", "feature-status.json");
const mdPath = path.join(root, "docs", "feature-status.md");

const allowedStatus = new Set(["pending", "in_progress", "done"]);

function readData() {
  if (!fs.existsSync(dataPath)) {
    throw new Error(`未找到 ${dataPath}，请先创建 feature-status.json`);
  }
  const text = fs.readFileSync(dataPath, "utf-8");
  return JSON.parse(text);
}

function writeData(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function statusMark(status) {
  if (status === "done") return "[x]";
  if (status === "in_progress") return "[~]";
  return "[ ]";
}

function statusLabel(status) {
  switch (status) {
    case "done":
      return "已完成";
    case "in_progress":
      return "进行中";
    default:
      return "待开始";
  }
}

function renderMarkdown(data) {
  const categories = new Map();
  for (const feature of data.features) {
    if (!categories.has(feature.category)) {
      categories.set(feature.category, []);
    }
    categories.get(feature.category).push(feature);
  }

  const sortedCategories = Array.from(categories.entries()).sort(([a], [b]) =>
    a.localeCompare(b, "zh-CN")
  );

  let md = `# 功能完成度追踪\n\n> 本文件由 \`server/update-feature-status.mjs\` 自动生成，请勿手动编辑。\n> 最后更新：${
    data.updatedAt ?? "尚未更新"
  }\n\n`;

  for (const [category, features] of sortedCategories) {
    md += `## ${category}\n\n`;
    md += "| 状态 | ID | 优先级 | 功能 | 描述 |\n";
    md += "|------|----|--------|------|------|\n";
    const sortedFeatures = features.sort((a, b) => a.id.localeCompare(b.id));
    for (const feature of sortedFeatures) {
      md += `| ${statusMark(feature.status)} ${statusLabel(
        feature.status
      )} | ${feature.id} | ${feature.priority} | ${feature.title} | ${
        feature.description
      } |\n`;
    }
    md += "\n";
  }
  md +=
    "状态说明：`[x] 已完成` · `[~] 进行中` · `[ ] 待开始`\n";
  return md;
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function main() {
  const id = getArg("--id");
  const status = getArg("--status");

  const data = readData();

  if (id && !status) {
    throw new Error("缺少 --status 参数");
  }

  if (status && !allowedStatus.has(status)) {
    throw new Error(`不支持的状态：${status}`);
  }

  if (id && status) {
    const feature = data.features.find((item) => item.id === id);
    if (!feature) {
      throw new Error(`未找到功能 ID：${id}`);
    }
    feature.status = status;
    feature.lastUpdated = new Date().toISOString();
    data.updatedAt = feature.lastUpdated;
    writeData(data);
  } else if (!data.updatedAt) {
    data.updatedAt = new Date().toISOString();
    writeData(data);
  }

  const refreshed = readData();
  const md = renderMarkdown(refreshed);
  fs.writeFileSync(mdPath, md, "utf-8");
}

main();
