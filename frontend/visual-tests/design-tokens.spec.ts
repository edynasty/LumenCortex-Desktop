import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const tokenMap = {
  "bg/app": "--bg",
  "bg/sidebar": "--sidebar",
  "bg/surface": "--surface",
  "bg/subtle": "--surface-soft",
  "bg/hover": "--surface-hover",
  "text/primary": "--text",
  "text/secondary": "--text-soft",
  "text/muted": "--muted",
  "border/subtle": "--border",
  "border/strong": "--border-strong",
  "accent/primary": "--accent",
  success: "--green",
  warning: "--amber",
  danger: "--red",
  info: "--blue",
} as const;

function designSystemLightTokens() {
  const markdown = readFileSync(resolve(process.cwd(), "../docs/design-system.md"), "utf8");
  const section = markdown.split("## 7. Light color tokens")[1]?.split("\n## ")[0] ?? "";
  return new Map(
    [...section.matchAll(/^- ([\w/]+):\s*(#[0-9a-fA-F]{6})$/gm)].map((match) => [
      match[1],
      match[2].toLowerCase(),
    ])
  );
}

test("light semantic tokens stay aligned with the canonical design system", async ({ page }) => {
  await page.goto("/visual.html?scene=new-task");
  await page.waitForLoadState("networkidle");

  const cssTokens = await page.evaluate((names) => {
    document.documentElement.removeAttribute("data-theme");
    const styles = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((name) => [name, styles.getPropertyValue(name).trim().toLowerCase()]));
  }, Object.values(tokenMap));

  const designTokens = designSystemLightTokens();

  for (const [designName, cssName] of Object.entries(tokenMap)) {
    expect(designTokens.get(designName), `missing canonical token ${designName}`).toBeTruthy();
    expect(cssTokens[cssName], `${cssName} drifted from ${designName}`).toBe(designTokens.get(designName));
  }
});


test("component stylesheet keeps reusable colors behind semantic tokens", () => {
  const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
  const literalColors = [
    ...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g),
    ...css.matchAll(/\brgba?\([^)]*\)/g),
    ...css.matchAll(/\bhsla?\([^)]*\)/g),
  ].map((match) => match[0]);

  expect(literalColors).toEqual([]);
});
