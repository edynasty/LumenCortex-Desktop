import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, pattern = /\.(ts|tsx)$/): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, pattern);
    return pattern.test(entry.name) ? [full] : [];
  });
}

describe("frontend architecture", () => {
  it("keeps direct Wails globals inside the typed bridge", () => {
    const src = path.resolve(process.cwd(), "src");
    const offenders = walk(src)
      .filter((file) => !file.endsWith(path.join("lib", "bridge.ts")))
      .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"))
      .filter((file) => {
        const content = fs.readFileSync(file, "utf8");
        return content.includes("window.go") || content.includes("window.runtime");
      });
    expect(offenders).toEqual([]);
  });

  it("keeps application copy out of App.tsx", () => {
    const app = fs.readFileSync(path.resolve(process.cwd(), "src", "App.tsx"), "utf8");
    expect(app).not.toContain("const copy =");
  });

  it("keeps production React components within the split threshold", () => {
    const src = path.resolve(process.cwd(), "src");
    const offenders = walk(src)
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => !file.endsWith(".test.tsx"))
      .map((file) => ({
        file: path.relative(src, file),
        lines: fs.readFileSync(file, "utf8").split("\n").length,
      }))
      .filter((entry) => entry.lines > 350);

    expect(offenders).toEqual([]);
  });

  // An undefined custom property or keyframe fails silently: the declaration falls back to
  // its initial value (no color, no animation) and nothing reports it.
  it("references only custom properties and keyframes the stylesheets define", () => {
    const src = path.resolve(process.cwd(), "src");
    const css = walk(src, /\.css$/).map((file) => ({ file: path.relative(src, file), text: fs.readFileSync(file, "utf8") }));
    const tsx = walk(src).filter((file) => !/\.test\.tsx?$/.test(file)).map((file) => ({ file: path.relative(src, file), text: fs.readFileSync(file, "utf8") }));
    const all = [...css, ...tsx];
    // Custom properties may also be set inline from TSX (`"--x": v`, `["--x" as string]: v`, `setProperty("--x", v)`).
    const defined = new Set(all.flatMap(({ text }) => [...text.matchAll(/["'\s{;(\[](--[\w-]+)["']?(?:\s+as\s+\w+)?\]?\s*[:,]/g)].map((m) => m[1])));
    const keyframes = new Set(css.flatMap(({ text }) => [...text.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])));
    const offenders = all.flatMap(({ file, text }) => [
      // A var() with a fallback is an explicit optional hook, not a missing definition.
      ...[...text.matchAll(/var\((--[\w-]+)\s*\)/g)].map((m) => m[1]).filter((name) => !defined.has(name)).map((name) => `${file}: ${name}`),
      ...[...text.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)]
        .flatMap((m) => m[1].split(","))
        .map((part) => part.trim().split(/\s+/).find((word) => /^[a-z][\w-]*$/i.test(word) && !/^(none|infinite|alternate|reverse|forwards|backwards|both|linear|ease(-in|-out|-in-out)?|step-(start|end)|normal|paused|running|var|calc|cubic-bezier|inherit|initial)$/.test(word)))
        .filter((name): name is string => Boolean(name) && !keyframes.has(name!))
        .map((name) => `${file}: @keyframes ${name}`),
    ]);
    expect([...new Set(offenders)]).toEqual([]);
  });
});
