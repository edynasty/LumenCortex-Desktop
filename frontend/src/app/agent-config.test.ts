import { describe, expect, it } from "vitest";
import { buildAgentConfig, composeFollowUpInput } from "./agent-config";

describe("turn mapping", () => {
  it("names the agent and keeps the user's policy and delegation grant unchanged", () => {
    expect(buildAgentConfig("test/a", "full", 24, "isolated", "reviewer", "high")).toEqual({
      modelRef: "test/a",
      effort: "high",
      policy: "full",
      maxSteps: 24,
      maxToolCallsPerStep: 8,
      delegation: "isolated",
      agent: "reviewer",
    });
  });

  it("never sends a model the user did not pick, so a switched agent keeps its first model", () => {
    const config = buildAgentConfig(undefined, "workspace", 24, "propose", "ask");
    expect(config.modelRef).toBeUndefined();
    expect(config.agent).toBe("ask");
    expect(Object.keys(JSON.parse(JSON.stringify(config)))).toEqual([
      "policy", "maxSteps", "maxToolCallsPerStep", "delegation", "agent",
    ]);
  });

  it("carries no Desktop-side cap or mode: Core applies the agent's ceilings", () => {
    const config = buildAgentConfig(undefined, "read-only", 3, "none", "ask");
    expect(config.policy).toBe("read-only");
    expect(config.delegation).toBe("none");
    expect(config).not.toHaveProperty("mode");
    expect(config).not.toHaveProperty("profileId");
    expect(config).not.toHaveProperty("instructions");
  });

  it("sends no agent for a child thread, whose pin Core keeps", () => {
    // A child Start ignores the requested agent (runtime constrainChild), so the composer names none.
    const config = buildAgentConfig(undefined, "read-only", 3, "none", undefined);
    expect(Object.keys(JSON.parse(JSON.stringify(config)))).not.toContain("agent");
  });

  it("composeFollowUpInput appends the attached context paths as a visible block", () => {
    expect(composeFollowUpInput("fix it", ["src/a.go", "src/b.go"], "Reference paths")).toBe(
      "fix it\n\nReference paths:\n- src/a.go\n- src/b.go",
    );
    expect(composeFollowUpInput("fix it", [], "Reference paths")).toBe("fix it");
    expect(composeFollowUpInput("fix it", ["  "], "Reference paths")).toBe("fix it");
  });
});
