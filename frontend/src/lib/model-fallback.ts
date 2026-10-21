import type { RuntimeEvent } from "../types";

// A run's model fallback (ADR-0009): Core emits provider.failover for a candidate that failed, with
// nextModelRef when another candidate is tried, window.overflow when the transcript does not fit the
// candidate's window (a larger-context candidate may take it), and llm.complete for the candidate
// that answered (core internal/agent/send.go). Events are live only, so a reopened thread shows no
// notice.
export type ModelFallback = {
  // from is the first model of the run that failed over; answeredBy the model of the last answer.
  from: string;
  answeredBy: string;
  // reason is Core's error class of that first failure: availability, capacity, ...
  reason: string;
};

// currentFallback is the fallback of sessionId's latest run, or null when that run's last answer came
// from the model it started with, or when no candidate answered (the failure shows as the run's error).
export function currentFallback(events: RuntimeEvent[], sessionId: string): ModelFallback | null {
  let from = "";
  let reason = "";
  let answeredBy = "";
  for (const event of events) {
    if (event.sessionId !== sessionId) continue;
    const data = event.data ?? {};
    if (event.type === "run.started") {
      from = reason = answeredBy = "";
    } else if (event.type === "provider.failover" && typeof data.nextModelRef === "string" && data.nextModelRef && !from) {
      from = String(data.modelRef ?? "");
      reason = String(data.class ?? "");
    } else if (event.type === "window.overflow" && !from) {
      // The transcript did not fit this model: Core switches to a candidate with a larger window,
      // which is a capacity failover too, but it emits no provider.failover for it.
      from = String(data.modelRef ?? "");
      reason = "capacity";
    } else if (event.type === "llm.complete" && from) {
      answeredBy = String(data.modelRef ?? "");
    }
  }
  return from && answeredBy && answeredBy !== from ? { from, answeredBy, reason } : null;
}
