import { describe, expect, it } from "vitest";
import { diffStats, parseUnifiedDiff, splitDiffRows } from "./diff";

describe("review diff parser", () => {
  const patch = [
    "diff --git a/demo.txt b/demo.txt",
    "--- a/demo.txt",
    "+++ b/demo.txt",
    "@@ -1,2 +1,2 @@",
    "-before",
    "+after",
    " keep",
  ].join("\n");

  it("parses line numbers and statistics", () => {
    const lines = parseUnifiedDiff(patch);
    expect(diffStats(lines)).toEqual({ additions: 1, deletions: 1 });
    expect(lines.find((line) => line.kind === "delete")).toMatchObject({ oldLine: 1, text: "before" });
    expect(lines.find((line) => line.kind === "add")).toMatchObject({ newLine: 1, text: "after" });
    expect(lines.find((line) => line.kind === "context")).toMatchObject({ oldLine: 2, newLine: 2, text: "keep" });
  });

  it("pairs adjacent delete/add lines for split layout", () => {
    const rows = splitDiffRows(parseUnifiedDiff(patch));
    const changed = rows.find((row) => row.left?.kind === "delete");
    expect(changed?.left?.text).toBe("before");
    expect(changed?.right?.text).toBe("after");
  });

  it("drops the file header and keeps hunk headers and in-hunk notes", () => {
    const lines = parseUnifiedDiff(`${patch}\n\\ No newline at end of file\n`);
    expect(lines.filter((line) => line.kind === "meta").map((line) => line.text)).toEqual([
      "@@ -1,2 +1,2 @@",
      "\\ No newline at end of file",
    ]);
  });

  it("counts in-hunk lines that start with -- or ++ as changes", () => {
    const lines = parseUnifiedDiff(["--- a/x.sql", "+++ b/x.sql", "@@ -1 +1 @@", "--- old comment", "+++ new comment"].join("\n"));
    expect(lines.filter((line) => line.kind !== "meta").map((line) => [line.kind, line.text])).toEqual([
      ["delete", "-- old comment"],
      ["add", "++ new comment"],
    ]);
  });
});
