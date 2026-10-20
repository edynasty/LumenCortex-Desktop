import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import { currentFallback } from "../../lib/model-fallback";
import type { RuntimeEvent } from "../../types";
import { ModelFallbackNotice } from "./ModelFallbackNotice";

let seq = 0;
function event(type: string, sessionId: string, data: Record<string, unknown> = {}): RuntimeEvent {
  return { seq: ++seq, at: "2026-10-21T00:00:00Z", type, sessionId, data };
}

// Core's events for one run whose pinned model a@high returned 503 and whose list moved to b.
const fellBack = [
  event("run.started", "s1"),
  event("provider.failover", "s1", { modelRef: "zen/a", nextModelRef: "zen/b", class: "availability", error: "503" }),
  event("llm.complete", "s1", { modelRef: "zen/b" }),
];

describe("ModelFallbackNotice", () => {
  it("names the model that answered and the one it fell back from (ADR-0009 A2 acceptance 7)", () => {
    render(<ModelFallbackNotice events={fellBack} sessionId="s1" labels={copy.en} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Answered by zen/b: zen/a was unavailable, so the agent's model list moved on. The next turn starts with zen/a again.",
    );
  });

  it("shows nothing for another thread", () => {
    const { container } = render(<ModelFallbackNotice events={fellBack} sessionId="s2" labels={copy.en} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("currentFallback", () => {
  it("forgets a fallback when the next run starts", () => {
    expect(currentFallback([...fellBack, event("run.started", "s1"), event("llm.complete", "s1", { modelRef: "zen/a" })], "s1")).toBeNull();
  });

  it("reports no fallback when no candidate answered: the run's failure is shown instead", () => {
    const failed = [
      event("run.started", "s1"),
      event("provider.failover", "s1", { modelRef: "zen/a", nextModelRef: "zen/b", class: "availability" }),
      event("provider.failover", "s1", { modelRef: "zen/b", class: "auth" }),
    ];
    expect(currentFallback(failed, "s1")).toBeNull();
  });

  it("keeps the first failed model when later candidates fail too, and the last answer", () => {
    const chain = [
      event("run.started", "s1"),
      event("provider.failover", "s1", { modelRef: "zen/a", nextModelRef: "zen/b", class: "capacity" }),
      event("provider.failover", "s1", { modelRef: "zen/b", nextModelRef: "zen/c", class: "availability" }),
      event("llm.complete", "s1", { modelRef: "zen/c" }),
    ];
    expect(currentFallback(chain, "s1")).toEqual({ from: "zen/a", answeredBy: "zen/c", reason: "capacity" });
  });
});
