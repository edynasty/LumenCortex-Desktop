import { describe, expect, it } from "vitest";
import { languageFromPath, tokenizeLine } from "./syntax";

describe("syntax tokenizer", () => {
  it("detects common languages from file paths", () => {
    expect(languageFromPath("main.go")).toBe("go");
    expect(languageFromPath("App.tsx")).toBe("ts");
    expect(languageFromPath("script.py")).toBe("py");
  });

  it("classifies keywords, strings, numbers, and comments", () => {
    const tokens = tokenizeLine('const answer = 42 // value', "ts");
    expect(tokens.some((token) => token.kind === "keyword" && token.text === "const")).toBe(true);
    expect(tokens.some((token) => token.kind === "number" && token.text === "42")).toBe(true);
    expect(tokens.some((token) => token.kind === "comment" && token.text.includes("// value"))).toBe(true);
  });

  it("keeps Python comments distinct from strings", () => {
    const tokens = tokenizeLine('print("ok") # comment', "py");
    expect(tokens.some((token) => token.kind === "string" && token.text === '"ok"')).toBe(true);
    expect(tokens.some((token) => token.kind === "comment" && token.text === "# comment")).toBe(true);
  });
});
