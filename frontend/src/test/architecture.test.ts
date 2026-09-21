import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe("frontend architecture", () => {
  it("keeps direct Wails globals inside the typed bridge", () => {
    const src = path.resolve(process.cwd(), "src");
    const offenders = walk(src)
      .filter((file) => !file.endsWith(path.join("lib", "bridge.ts")))
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
});
