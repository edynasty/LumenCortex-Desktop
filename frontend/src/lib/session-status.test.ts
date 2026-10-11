import { describe, expect, it } from "vitest";
import { copy } from "./i18n/app-copy";
import { runtimeNotice } from "./runtime-notice";
import { isRunHeldError, isRunningElsewhere, kindLabel, sessionCause } from "./session-status";

const kinds = [
  "cancelled", "max_steps", "empty_response", "provider:availability", "stale_run_recovered",
  "workflow_gate",
  "provider:auth", "provider:bad_request", "provider:capacity", "window_overflow",
  "transcript_unpaired", "config", "storage", "panic",
];

describe("session status detail", () => {
  it.each(["zh-CN", "en"] as const)("has copy for every §4.1 kind in %s", (locale) => {
    for (const kind of kinds) {
      expect(kindLabel(copy[locale], kind), kind).not.toBe(kind);
    }
  });

  it("shows an unknown kind by its raw value", () => {
    expect(kindLabel(copy.en, "provider:future_thing")).toBe("provider:future_thing");
    expect(kindLabel(copy.en, "constructor")).toBe("constructor");
  });

  it("reads the stored cause only when it is an object with detail", () => {
    expect(sessionCause({ error: { kind: "cancelled", message: "m", at: "t" } })).toEqual({ kind: "cancelled", message: "m", at: "t" });
    expect(sessionCause({ error: "boom" })).toBeNull();
    expect(sessionCause({ error: {} })).toBeNull();
    expect(sessionCause({})).toBeNull();
  });

  it("treats a running session this process does not run as running elsewhere", () => {
    expect(isRunningElsewhere("running", false)).toBe(true);
    expect(isRunningElsewhere("running", true)).toBe(false);
    expect(isRunningElsewhere("interrupted", false)).toBe(false);
  });

  it("recognizes ErrRunHeld from the Go bridge", () => {
    expect(isRunHeldError("Error: run is active in another process or engine")).toBe(true);
    expect(isRunHeldError("agent run is already active")).toBe(false);
  });
});

describe("runtime notices", () => {
  it("uses centralized copy per origin and keeps the row text for completion_blocked", () => {
    expect(runtimeNotice(copy.en, "tool_interrupted", "run ended before the tool result was saved")).toEqual({
      title: copy.en.originToolInterrupted,
      body: copy.en.originToolInterruptedBody,
    });
    expect(runtimeNotice(copy["zh-CN"], "completion_blocked", "gate rejected")).toEqual({
      title: copy["zh-CN"].originCompletionBlocked,
      body: "gate rejected",
    });
  });

  it.each(["zh-CN", "en"] as const)("has copy for every A7 origin in %s", (locale) => {
    for (const origin of ["tool_interrupted", "completion_blocked", "resume", "turn"]) {
      expect(runtimeNotice(copy[locale], origin, "row text").title, origin).not.toBe(origin);
    }
  });

  it("keeps the row text for resume and turn", () => {
    expect(runtimeNotice(copy.en, "resume", "resume text")).toEqual({ title: copy.en.originResume, body: "resume text" });
    expect(runtimeNotice(copy["zh-CN"], "turn", "turn text")).toEqual({ title: copy["zh-CN"].originTurn, body: "turn text" });
  });

  it("shows an unknown origin by its raw value", () => {
    expect(runtimeNotice(copy.en, "future_origin", "text")).toEqual({ title: "future_origin", body: "text" });
  });
});
