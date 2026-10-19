import { describe, expect, it } from "vitest";
import { buildAgentConfig, composeFollowUpInput, resolveTurnOptions } from "./agent-config";

describe("Ask/Agent turn mapping", () => {
  it("Ask forces read-only and no delegation, never widening a higher policy", () => {
    expect(resolveTurnOptions("ask", "full", "isolated")).toEqual({ policy: "read-only", delegation: "none" });
    expect(resolveTurnOptions("ask", "workspace", "propose")).toEqual({ policy: "read-only", delegation: "none" });
    expect(resolveTurnOptions("ask", "read-only", "none")).toEqual({ policy: "read-only", delegation: "none" });
  });

  it("Agent keeps the user's policy and delegation grant unchanged", () => {
    expect(resolveTurnOptions("agent", "workspace", "propose")).toEqual({ policy: "workspace", delegation: "propose" });
    expect(resolveTurnOptions("agent", "full", "isolated")).toEqual({ policy: "full", delegation: "isolated" });
  });

  it("buildAgentConfig sends the mapped turn and the mode for the backend guard", () => {
    expect(buildAgentConfig("test/a", "full", 24, "isolated", "ask", undefined, "reviewer")).toEqual({
      modelRef: "test/a",
      effort: undefined,
      policy: "read-only",
      maxSteps: 24,
      maxToolCallsPerStep: 8,
      delegation: "none",
      mode: "ask",
      profileId: "reviewer",
    });
    expect(buildAgentConfig(undefined, "workspace", 24, "propose", "agent", "high", "agent")).toEqual({
      effort: "high",
      policy: "workspace",
      maxSteps: 24,
      maxToolCallsPerStep: 8,
      delegation: "propose",
      mode: "agent",
      profileId: "agent",
    });
  });

  it("composeFollowUpInput appends the attached context paths as a visible block", () => {
    expect(composeFollowUpInput("fix it", ["src/a.go", "src/b.go"], "Reference paths")).toBe(
      "fix it\n\nReference paths:\n- src/a.go\n- src/b.go",
    );
    expect(composeFollowUpInput("fix it", [], "Reference paths")).toBe("fix it");
    expect(composeFollowUpInput("fix it", ["  "], "Reference paths")).toBe("fix it");
  });
});
