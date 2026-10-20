import { describe, expect, it } from "vitest";
import { DELEGATION_ORDER, POLICY_ORDER, underCeiling } from "./agent-catalog";

// The composer must show what Core runs: min(grant, ceiling) (ADR-0009), never the uncapped grant.
describe("underCeiling", () => {
  it.each([
    ["full", "read-only", ["read-only"], "read-only"],
    ["read-only", "read-only", ["read-only"], "read-only"],
    ["full", "workspace", ["read-only", "workspace"], "workspace"],
    ["read-only", "workspace", ["read-only", "workspace"], "read-only"],
    ["workspace", "full", ["read-only", "workspace", "full"], "workspace"],
  ] as const)("policy grant %s under ceiling %s", (grant, ceiling, allowed, effective) => {
    expect(underCeiling(POLICY_ORDER, grant, ceiling)).toEqual({ allowed, effective });
  });

  it("caps delegation the same way", () => {
    expect(underCeiling(DELEGATION_ORDER, "isolated", "propose")).toEqual({ allowed: ["none", "propose"], effective: "propose" });
    expect(underCeiling(DELEGATION_ORDER, "isolated", "none")).toEqual({ allowed: ["none"], effective: "none" });
  });
});
