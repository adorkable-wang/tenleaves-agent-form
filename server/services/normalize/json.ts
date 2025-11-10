type DashscopeMessage = {
  role: "assistant" | "system" | "user";
  content?: string | unknown[];
};

export function extractPayload(
  content: DashscopeMessage["content"]
): Record<string, unknown> {
  if (!content) return {};
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed) return {};
    const parsed = extractJsonFromText(trimmed) ?? tryParseJSON(trimmed);
    if (parsed && typeof parsed === "object") {
      return ensureStructure(parsed as Record<string, unknown>);
    }
    return ensureStructure({ summary: trimmed });
  }
  if (Array.isArray(content)) {
    const concatenated = content
      .map((chunk) => {
        if (typeof chunk === "string") return chunk;
        if (chunk && typeof chunk === "object" && "text" in chunk) {
          return typeof (chunk as { text?: string }).text === "string"
            ? (chunk as { text?: string }).text
            : "";
        }
        return "";
      })
      .join("")
      .trim();
    if (!concatenated) return {};
    const parsed =
      extractJsonFromText(concatenated) ?? tryParseJSON(concatenated);
    if (parsed && typeof parsed === "object") {
      return ensureStructure(parsed as Record<string, unknown>);
    }
    return ensureStructure({ summary: concatenated });
  }
  if (typeof content === "object") {
    return ensureStructure(content as Record<string, unknown>);
  }
  return ensureStructure({});
}

function ensureStructure(payload: Record<string, unknown>): Record<string, unknown> {
  return payload;
}

function tryParseJSON(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJsonFromText(text: string): unknown | null {
  const fenced = matchCodeFence(text);
  if (fenced) {
    const parsed = tryParseJSON(fenced);
    if (parsed != null) return parsed;
  }

  const jsonSlice = findFirstJsonSlice(text);
  if (jsonSlice) {
    const parsed = tryParseJSON(jsonSlice);
    if (parsed != null) return parsed;
  }

  if (text.includes("{") || text.includes("[")) {
    const fixed = relaxFixJson(text);
    const viaFence = matchCodeFence(fixed);
    if (viaFence) {
      const parsed = tryParseJSON(viaFence);
      if (parsed != null) return parsed;
    }
    const slice2 = findFirstJsonSlice(fixed);
    if (slice2) {
      const parsed = tryParseJSON(slice2);
      if (parsed != null) return parsed;
    }
    const parsed = tryParseJSON(fixed);
    if (parsed != null) return parsed;
  }
  return null;
}

function matchCodeFence(input: string): string | null {
  const re = /```\s*(json)?\s*\n([\s\S]*?)\n```/i;
  const m = re.exec(input);
  return m ? m[2].trim() : null;
}

function findFirstJsonSlice(input: string): string | null {
  const idxBrace = input.indexOf("{");
  const idxBracket = input.indexOf("[");
  const startIdx =
    idxBrace === -1
      ? idxBracket
      : idxBracket === -1
      ? idxBrace
      : Math.min(idxBrace, idxBracket);
  if (startIdx === -1) return null;
  let i = startIdx;
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      if (!stack.length) break;
      const last = stack[stack.length - 1];
      if ((last === "{" && ch === "}") || (last === "[" && ch === "]"))
        stack.pop();
      else return null;
      if (!stack.length) {
        const slice = input.slice(startIdx, i + 1);
        return slice;
      }
    }
  }
  return null;
}

function relaxFixJson(input: string): string {
  let s = input;
  s = s.replace(/```\s*(json)?/gi, "").replace(/```/g, "");
  s = s.replace(/([,{]\s*)([A-Za-z_][A-Za-z0-9_]*?)\s*:/g, '$1"$2":');
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s;
}
