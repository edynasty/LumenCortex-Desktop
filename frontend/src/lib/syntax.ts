export type SyntaxTokenKind = "plain" | "keyword" | "string" | "number" | "comment" | "type";

export type SyntaxToken = {
  kind: SyntaxTokenKind;
  text: string;
};

const keywordSets: Record<string, Set<string>> = {
  go: new Set(["break","case","chan","const","continue","default","defer","else","fallthrough","for","func","go","goto","if","import","interface","map","package","range","return","select","struct","switch","type","var"]),
  ts: new Set(["as","async","await","break","case","catch","class","const","continue","default","delete","do","else","export","extends","false","finally","for","from","function","if","implements","import","in","instanceof","interface","let","new","null","of","private","protected","public","readonly","return","static","super","switch","this","throw","true","try","type","typeof","undefined","var","void","while","yield"]),
  js: new Set(["async","await","break","case","catch","class","const","continue","default","delete","do","else","export","extends","false","finally","for","from","function","if","import","in","instanceof","let","new","null","of","return","static","super","switch","this","throw","true","try","typeof","undefined","var","void","while","yield"]),
  py: new Set(["and","as","assert","async","await","break","class","continue","def","del","elif","else","except","False","finally","for","from","global","if","import","in","is","lambda","None","nonlocal","not","or","pass","raise","return","True","try","while","with","yield"]),
  rs: new Set(["as","async","await","break","const","continue","crate","dyn","else","enum","extern","false","fn","for","if","impl","in","let","loop","match","mod","move","mut","pub","ref","return","self","Self","static","struct","super","trait","true","type","unsafe","use","where","while"]),
  sh: new Set(["case","do","done","elif","else","esac","export","fi","for","function","if","in","local","readonly","return","then","while"]),
};

export function languageFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".go")) return "go";
  if (lower.endsWith(".tsx") || lower.endsWith(".ts")) return "ts";
  if (lower.endsWith(".jsx") || lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return "js";
  if (lower.endsWith(".py")) return "py";
  if (lower.endsWith(".rs")) return "rs";
  if (lower.endsWith(".sh") || lower.endsWith(".bash") || lower.endsWith(".zsh")) return "sh";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  return "text";
}

export function normalizeLanguage(value?: string): string {
  const lower = (value || "").trim().toLowerCase();
  if (["typescript","tsx","ts"].includes(lower)) return "ts";
  if (["javascript","jsx","js"].includes(lower)) return "js";
  if (["python","py"].includes(lower)) return "py";
  if (["rust","rs"].includes(lower)) return "rs";
  if (["shell","bash","sh","zsh"].includes(lower)) return "sh";
  if (["golang","go"].includes(lower)) return "go";
  return lower || "text";
}

export function tokenizeLine(line: string, language?: string): SyntaxToken[] {
  const lang = normalizeLanguage(language);
  const keywords = keywordSets[lang] || new Set<string>();
  const commentPrefix = lang === "py" || lang === "sh" ? "#" : "//";

  const commentAt = line.indexOf(commentPrefix);
  const source = commentAt >= 0 ? line.slice(0, commentAt) : line;
  const comment = commentAt >= 0 ? line.slice(commentAt) : "";

  const pattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][A-Za-z0-9_$]*\b)/g;
  const out: SyntaxToken[] = [];
  let cursor = 0;

  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) out.push({ kind: "plain", text: source.slice(cursor, index) });
    const token = match[0];
    let kind: SyntaxTokenKind = "plain";
    if (token.startsWith('"') || token.startsWith("'")) kind = "string";
    else if (/^\d/.test(token)) kind = "number";
    else if (keywords.has(token)) kind = "keyword";
    else if (/^[A-Z]/.test(token)) kind = "type";
    out.push({ kind, text: token });
    cursor = index + token.length;
  }

  if (cursor < source.length) out.push({ kind: "plain", text: source.slice(cursor) });
  if (comment) out.push({ kind: "comment", text: comment });
  return out.length ? out : [{ kind: "plain", text: line }];
}
