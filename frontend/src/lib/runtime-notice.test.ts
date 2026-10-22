import { describe, expect, it } from "vitest";
import { runtimeNotice, type RuntimeNoticeCopy } from "./runtime-notice";

const labels: RuntimeNoticeCopy = {
  originToolInterrupted: "Tool call interrupted",
  originToolInterruptedBody: "The run ended before this tool call's result was saved.",
  originCompletionBlocked: "Completion blocked",
  originResume: "Run resumed",
  originTurn: "New turn",
  originImported: "History imported from another runtime",
  originImportedNotice: "OMP notice",
  originImportedMarker: "OMP session event",
};

describe("runtimeNotice", () => {
  it("keeps the existing origins' titles and bodies", () => {
    expect(runtimeNotice(labels, "tool_interrupted", "ignored")).toEqual({
      title: labels.originToolInterrupted,
      body: labels.originToolInterruptedBody,
    });
    expect(runtimeNotice(labels, "completion_blocked", "tests missing")).toEqual({
      title: labels.originCompletionBlocked,
      body: "tests missing",
    });
  });

  it("labels the rows an OMP import wrote with their own localized titles", () => {
    expect(runtimeNotice(labels, "imported", "The messages above were imported")).toEqual({
      title: labels.originImported,
      body: "The messages above were imported",
    });
    expect(runtimeNotice(labels, "imported_marker", "[runtime] The source session compacted its context here")).toEqual({
      title: labels.originImportedMarker,
      body: "[runtime] The source session compacted its context here",
    });
  });

  it("keeps an imported notice's own [OMP <type>] label in the body", () => {
    const content = "[OMP async-result]\nBackground task finished.";
    expect(runtimeNotice(labels, "imported_notice", content)).toEqual({
      title: labels.originImportedNotice,
      body: content,
    });
  });

  it("falls back to the raw origin for a value this build does not know", () => {
    expect(runtimeNotice(labels, "future_origin", "content")).toEqual({ title: "future_origin", body: "content" });
  });
});
