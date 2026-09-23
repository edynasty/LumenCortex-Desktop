import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Manifest = {
  pages: Record<string, string>;
  productScreens: Array<{ name: string; widths: number[] }>;
  componentStates: Record<string, string[]>;
  flows: Array<{ name: string; durationMs: number; easing: string; reducedMotion: string }>;
};

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "../tools/figma/delivery-manifest.json"), "utf8"),
) as Manifest;

describe("Figma delivery manifest", () => {
  it("locks the required design pages and responsive screen widths", () => {
    expect(manifest.pages).toEqual({
      designSystem: "01 Design System",
      productScreens: "02 Product Screens",
      flowsAndSpecs: "03 Flows & Specs",
    });

    const widths = [1440, 1180, 820, 560];
    expect(manifest.productScreens.map((screen) => screen.name)).toEqual([
      "New Task",
      "Running Thread",
      "Provider Settings",
      "Review Diff",
    ]);
    for (const screen of manifest.productScreens) expect(screen.widths).toEqual(widths);
  });

  it("covers the full production component state matrix", () => {
    expect(manifest.componentStates["Button / Primary"]).toEqual([
      "Default", "Hover", "Focus", "Pressed", "Disabled", "Loading",
    ]);
    expect(manifest.componentStates["Input"]).toEqual([
      "Default", "Focus", "Invalid", "Disabled",
    ]);
    expect(manifest.componentStates["Thread Row"]).toEqual([
      "Default", "Hover", "Selected", "Running", "Attention", "Error",
    ]);
    expect(manifest.componentStates["Composer"]).toEqual([
      "Default", "Focus", "Running", "Disabled", "Error",
    ]);
    expect(manifest.componentStates["Status Indicator"]).toEqual([
      "Running", "Success", "Waiting", "Interrupted", "Info", "Completed",
    ]);
  });

  it("covers every required interaction flow with motion and reduced-motion guidance", () => {
    expect(manifest.flows.map((flow) => flow.name)).toEqual([
      "Sidebar / Inspector drawer",
      "Composer → Thread",
      "Provider expand / collapse",
      "Review inline comment",
    ]);
    for (const flow of manifest.flows) {
      expect(flow.durationMs).toBeGreaterThanOrEqual(80);
      expect(flow.durationMs).toBeLessThanOrEqual(220);
      expect(flow.easing.trim()).not.toBe("");
      expect(flow.reducedMotion.trim()).not.toBe("");
    }
  });
});
