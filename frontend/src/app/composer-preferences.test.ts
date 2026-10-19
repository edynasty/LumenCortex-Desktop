import { beforeEach, describe, expect, it } from "vitest";
import { readComposerPreferences, saveComposerPreferences } from "./composer-preferences";

describe("composer preferences", () => {
  beforeEach(() => localStorage.clear());

  it("starts at the safe defaults", () => {
    expect(readComposerPreferences()).toEqual({ policy: "workspace", mode: "agent", agentId: "agent", effort: undefined, modelRef: undefined });
  });

  it("remembers each choice and lets one be cleared", () => {
    saveComposerPreferences({ policy: "full", mode: "ask", agentId: "profile-1" });
    saveComposerPreferences({ effort: "high", modelRef: "a/b" });
    expect(readComposerPreferences()).toEqual({ policy: "full", mode: "ask", agentId: "profile-1", effort: "high", modelRef: "a/b" });
    saveComposerPreferences({ effort: "auto" });
    expect(readComposerPreferences().effort).toBe("auto");
    saveComposerPreferences({ effort: undefined });
    expect(readComposerPreferences().effort).toBeUndefined();
    expect(readComposerPreferences().policy).toBe("full");
  });

  it("ignores stored values that are not valid choices", () => {
    localStorage.setItem("lcx-composer", JSON.stringify({ policy: "root", mode: 3, agentId: 9, effort: "ultra", modelRef: 7 }));
    expect(readComposerPreferences()).toEqual({ policy: "workspace", mode: "agent", agentId: "agent", effort: undefined, modelRef: undefined });
    localStorage.setItem("lcx-composer", "not json");
    expect(readComposerPreferences().policy).toBe("workspace");
  });
});
