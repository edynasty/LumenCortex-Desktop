import { describe, expect, it } from "vitest";
import { copy } from "../lib/i18n/app-copy";
import type { AgentEntry } from "../types";
import {
  DELEGATION_ORDER, POLICY_ORDER, pendingAgentImportNotice, underCeiling, validateAgentDraft,
} from "./agent-catalog";

const labels = copy.en;

function draft(overrides: Partial<AgentEntry> = {}): AgentEntry {
  return {
    id: "hybrid", name: "Hybrid", description: "", use: "conversation", policy: "full", delegation: "isolated",
    instructions: "", models: null, builtin: false, source: "global", digest: "", forConversation: true, editable: true,
    ...overrides,
  };
}

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

// Core treats every non-conversation use as delegation: the ceiling is read-only or workspace, a
// description is required, and delegation is cleared (the backend sends none).
describe("validateAgentDraft for a delegated agent", () => {
  it("requires a read-only or workspace ceiling", () => {
    expect(validateAgentDraft(draft({ use: "both", description: "Runs both." }), [], labels)).toBe(labels.agentDelegationPolicy);
    expect(validateAgentDraft(draft({ use: "delegation", description: "Reads." }), [], labels)).toBe(labels.agentDelegationPolicy);
  });

  it("requires a description", () => {
    expect(validateAgentDraft(draft({ use: "both", policy: "read-only" }), [], labels)).toBe(labels.agentDelegationNeedsDescription);
    expect(validateAgentDraft(draft({ use: "delegation", policy: "workspace", description: " " }), [], labels))
      .toBe(labels.agentDelegationNeedsDescription);
  });

  it("accepts a both agent that Core can load, and a conversation agent with no ceiling", () => {
    expect(validateAgentDraft(draft({ use: "both", policy: "read-only", description: "Runs both." }), [], labels)).toBe("");
    expect(validateAgentDraft(draft(), [], labels)).toBe("");
  });
});

describe("the one-time agents.json notice", () => {
  const record = (overrides = {}) => ({
    imported: false, alreadyImported: true, custom: 0, builtinOverrides: [] as string[] | null,
    skipped: 0, warnings: [] as string[] | null, ...overrides,
  });

  it("shows only when the import changed something", () => {
    expect(pendingAgentImportNotice(undefined)).toBeUndefined();
    // An alreadyImported record whose import imported nothing has nothing to report.
    expect(pendingAgentImportNotice(record())).toBeUndefined();
    for (const changed of [
      record({ custom: 1 }),
      record({ builtinOverrides: ["ask"] }),
      record({ skipped: 2 }),
      record({ warnings: ["a warning"] }),
    ]) {
      expect(pendingAgentImportNotice(changed)).toBe(changed);
    }
  });

  it("stays hidden after the user dismissed it", () => {
    expect(pendingAgentImportNotice(record({ custom: 1, dismissedAt: "2026-10-22T10:00:00Z" }))).toBeUndefined();
  });
});
