import { describe, expect, it } from "vitest";
import { currentFallback } from "./model-fallback";
import type { RuntimeEvent } from "../types";

function event(type: string, data: Record<string, unknown> = {}, sessionId = "s1"): RuntimeEvent {
  return { type, sessionId, data } as RuntimeEvent;
}

describe("currentFallback", () => {
  it("reports a provider failover that another model answered", () => {
    expect(currentFallback([
      event("run.started"),
      event("provider.failover", { modelRef: "test/a", class: "availability", nextModelRef: "test/b" }),
      event("llm.complete", { modelRef: "test/b" }),
    ], "s1")).toEqual({ from: "test/a", answeredBy: "test/b", reason: "availability" });
  });

  // Core emits window.overflow, not provider.failover, when the transcript does not fit the model
  // and a larger-context candidate answers (internal/agent/send.go).
  it("reports a context-window overflow that switched model", () => {
    expect(currentFallback([
      event("run.started"),
      event("window.overflow", { step: 2, modelRef: "test/small", error: "transcript does not fit" }),
      event("llm.complete", { modelRef: "test/large" }),
    ], "s1")).toEqual({ from: "test/small", answeredBy: "test/large", reason: "capacity" });
  });

  it("shows nothing when the overflow had no larger candidate and the run failed", () => {
    expect(currentFallback([
      event("run.started"),
      event("window.overflow", { step: 1, modelRef: "test/small", error: "transcript does not fit" }),
    ], "s1")).toBeNull();
  });

  it("keeps the first failing model when a later candidate fails over too", () => {
    expect(currentFallback([
      event("run.started"),
      event("window.overflow", { modelRef: "test/small" }),
      event("provider.failover", { modelRef: "test/large", class: "availability", nextModelRef: "test/huge" }),
      event("llm.complete", { modelRef: "test/huge" }),
    ], "s1")).toEqual({ from: "test/small", answeredBy: "test/huge", reason: "capacity" });
  });

  it("ignores another session's events", () => {
    expect(currentFallback([
      event("run.started"),
      event("window.overflow", { modelRef: "test/small" }, "other"),
      event("llm.complete", { modelRef: "test/large" }),
    ], "s1")).toBeNull();
  });
});
