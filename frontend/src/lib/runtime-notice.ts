export type RuntimeNoticeCopy = Record<
  | "originToolInterrupted"
  | "originToolInterruptedBody"
  | "originCompletionBlocked"
  | "originResume"
  | "originTurn"
  | "originImported"
  | "originImportedNotice"
  | "originImportedMarker",
  string
>;

export type RuntimeNotice = { title: string; body: string };

// Rows the runtime wrote carry `origin` in their stored JSON. The copy is
// centralized; an origin this build does not know keeps its raw value as the title.
// The imported_* origins come from an OMP import (ADR-0011): the transcript is another runtime's
// history, so its final notice, copied notices and compaction/branch markers read as notices too.
export function runtimeNotice(labels: RuntimeNoticeCopy, origin: string, content: string): RuntimeNotice {
  switch (origin) {
    case "tool_interrupted":
      return { title: labels.originToolInterrupted, body: labels.originToolInterruptedBody };
    case "completion_blocked":
      return { title: labels.originCompletionBlocked, body: content };
    case "resume":
      return { title: labels.originResume, body: content };
    case "turn":
      return { title: labels.originTurn, body: content };
    case "imported":
      return { title: labels.originImported, body: content };
    // The content already begins with its "[OMP <type>]" label: nothing is stripped.
    case "imported_notice":
      return { title: labels.originImportedNotice, body: content };
    case "imported_marker":
      return { title: labels.originImportedMarker, body: content };
    default:
      return { title: origin, body: content };
  }
}
